import { UNIT_DATA, UnitKind, unitData } from '../数据/UnitData';
import { CityCell, DEFAULT_FARM, farmPlacementError } from '../城市/CityLayout';
import { FARM_LEVELS, TOWN_NODES, BUILDING_DESIGNS, HOSPITAL_RULES } from '../城市/TownDesign';
import { ResearchState, newResearchState, validResearchState, tickResearch, researchRound, researchWildWave, researchPeriod } from '../城市/ResearchEconomy';
import { TechnologyLevels, validTechnologyLevels, purchaseTechnology, technologyModifiers } from '../城市/TechnologySystem';
import { ENCOUNTERS, PLAYABLE_ROUNDS, WILD_RULES, wildRoster } from './MonsterWaves';
export type Kind=UnitKind;
export type Phase='ready'|'battle'|'victory'|'defeat'|'complete';
export interface Unit { id:number; kind:Kind; x:number; y:number; hp:number; cooldown:number; flash:number; swing:number; target:number; post?:number; wave?:number; main?:boolean; protectedBy?:number; entered?:Record<string,number>; lastAttacker?:number; attackedAt?:number }
export type PlotKind='farm'|'militiaCamp'|'archerCamp'|'hospital';
export const PLOT_BUILDING_IDS:Record<PlotKind,string>={farm:'B001',militiaCamp:'B004',archerCamp:'B003',hospital:'B006'};
export interface CityPlot extends CityCell { id:number; kind:PlotKind; level:number; timer:number }
interface WildState { timer:number; serial:number; active:number; first:boolean }
interface PendingSpawn { kind:Kind; delay:number; slot:number }
export interface Snapshot {
 version:1; phase:Phase; round:number; coins:number; cityLevel:number; cityHp:number; farm:boolean; farmTime:number; kingPaid:boolean;
 units:Unit[]; nextId:number; focus:number; elapsed:number; farmPlot?:CityCell; research?:ResearchState; technologies?:TechnologyLevels;
 buildings?:string[]; farmLevel?:number; plots?:CityPlot[]; completed?:number; wild?:WildState; pending?:PendingSpawn[]; goblinBossDefeated?:boolean;
}
export interface SaveData { state:Snapshot; checkpoint:Snapshot|null }
export const RULES={cityHp:100,upgradeCost:30,farmCost:5,recruitCost:1,armyCap:8,farmSeconds:10,totalRounds:PLAYABLE_ROUNDS,cityRadius:1.5} as const;
const clone=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
export function damage(attack:number,defense:number):number {return Math.max(0,attack-defense);}
export function guardPost(post:number):{x:number;y:number} {const angle=post*2.399;return {x:Math.cos(angle)*2.7,y:Math.sin(angle)*2.7};}
const allied=(u:Unit)=>unitData(u.kind).side==='ally';
const distance=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
export class BattleModel {
 state:Snapshot;checkpoint:Snapshot|null=null;message='国王派你来到蛮荒平原。三名护卫已就位，准备迎敌。';
 constructor(){this.state={version:1,phase:'ready',round:0,coins:0,cityLevel:0,cityHp:100,farm:false,farmTime:0,kingPaid:false,units:[],nextId:1,focus:0,elapsed:0,research:newResearchState(),completed:0,plots:[],wild:{timer:0,serial:0,active:0,first:true},pending:[]};for(let i=0;i<3;i++)this.addAlly('guard');}
 // guards为旧接口名，表示全部驻军，保证名额、回位与旧存档兼容。
 get guards():Unit[]{return this.state.units.filter(u=>allied(u)&&u.hp>0);}
 get enemies():Unit[]{return this.state.units.filter(u=>!allied(u)&&u.hp>0);}
 get completed():number{return this.state.completed??(['victory','complete'].includes(this.state.phase)?this.state.round:Math.max(0,this.state.round-1));}
 get wild():WildState{return this.state.wild??={timer:0,serial:0,active:0,first:true};}
 get plots():CityPlot[]{
  const s=this.state;
  if(!s.plots)s.plots=s.farm?[{id:1,kind:'farm',...(s.farmPlot??DEFAULT_FARM),level:s.farmLevel??1,timer:s.farmTime}]:[];
  // 兼容旧调用方只写入farm的情况。
  if(s.farm&&!s.plots.some(p=>p.kind==='farm'))s.plots.push({id:Math.max(0,...s.plots.map(p=>p.id))+1,kind:'farm',...(s.farmPlot??DEFAULT_FARM),level:s.farmLevel??1,timer:s.farmTime});
  return s.plots;
 }
 get townName():string{return TOWN_NODES[this.state.cityLevel].name;}
 get cityRadius():number{return this.state.cityLevel>=2?6:4;}
 get armyCapacity():number{return TOWN_NODES[this.state.cityLevel].capacity;}
 get maxCityHp():number{return TOWN_NODES[this.state.cityLevel].hp+this.modifiers.cityHp;}
 get modifiers(){return technologyModifiers(this.state.technologies??{});}
 get farmCapacity():number{return TOWN_NODES[this.state.cityLevel].farms+this.modifiers.farmCapacity;}
 get research():ResearchState{return this.state.research??=newResearchState(this.state.round);}
 get activeCombat():boolean{return this.enemies.length>0||this.state.phase==='battle';}
 rewardWildWave(waveId:string):number{return this.state.phase==='defeat'?0:researchWildWave(this.research,waveId);}
 researchTechnology(id:string):string{
  if(this.state.phase==='defeat')return '城池已失守';
  const a=this.research,period=researchPeriod(a),wallet={points:a.points,coins:this.state.coins};const levels=this.state.technologies??={};
  const error=purchaseTechnology(levels,id,wallet,{hasTower:a.towerBuilt,town:this.state.cityLevel,farmLevel:Math.max(0,...this.plots.filter(p=>p.kind==='farm').map(p=>p.level)),buildings:this.state.buildings??[]});if(error)return error;
  a.points=wallet.points;this.state.coins=wallet.coins;a.outputBonus=this.modifiers.researchOutput;a.periodReduction=Math.min(29,this.modifiers.researchPeriod);a.timer=a.timer/period*researchPeriod(a);return '';
 }
 private addAlly(kind:Kind):void{
  const occupied=new Set(this.guards.map(u=>u.post));let post=0;while(occupied.has(post))post++;
  this.state.units.push({id:this.state.nextId++,kind,...guardPost(post),post,hp:unitData(kind).hp,cooldown:0,flash:0,swing:0,target:0});
 }
 recruit(kind:Kind='guard'):boolean{
  const data=unitData(kind),s=this.state;
  if(!['guard','militia','archer'].includes(kind)||data.cost===null||s.phase==='defeat'||s.coins<data.cost||this.guards.length>=this.armyCapacity)return false;
  const building=kind==='militia'?'militiaCamp':kind==='archer'?'archerCamp':null;
  if(building&&!this.plots.some(p=>p.kind===building))return false;
  s.coins-=data.cost;this.addAlly(kind);this.message=data.name+'加入驻军。';return true;
 }
 dismiss(id:number):boolean{if(this.activeCombat||this.state.phase==='defeat')return false;const unit=this.guards.find(u=>u.id===id);if(!unit)return false;this.state.units=this.state.units.filter(u=>u.id!==id);this.message='已遣散'+unitData(unit.kind).name+'，不返还招募费。';return true;}
 get repairCost():number{return Math.ceil((this.maxCityHp-this.state.cityHp)/5);}
 repairCity():boolean{const cost=this.repairCost;if(this.activeCombat||this.state.phase==='defeat'||cost<=0||this.state.coins<cost)return false;this.state.coins-=cost;this.state.cityHp=this.maxCityHp;this.message='工匠已修缮城池，花费'+cost+'铜币；士兵不会因此回血。';return true;}
 get hasHospital():boolean{return this.plots.some(p=>p.kind==='hospital');}
 treatmentCost(id?:number):number{
  const patients=this.guards.filter(u=>id===undefined||u.id===id);
  return Math.max(0,Math.ceil(patients.reduce((total,u)=>total+Math.max(0,unitData(u.kind).hp-u.hp),0)/HOSPITAL_RULES.hpPerCopper-1e-9));
 }
 treat(id?:number):boolean{
  if(!this.hasHospital){this.message='先在城内建造医院。';return false;}
  if(this.activeCombat||this.state.phase==='defeat'){this.message='交战期间不能治疗，请先击退场上敌人。';return false;}
  const cost=this.treatmentCost(id);
  if(cost<=0){this.message='没有需要治疗的存活士兵。';return false;}
  if(this.state.coins<cost){this.message='治疗需要'+cost+'铜币。';return false;}
  this.state.coins-=cost;for(const u of this.guards.filter(u=>id===undefined||u.id===id))u.hp=unitData(u.kind).hp;
  this.message=(id===undefined?'全队':'士兵')+'治疗完成，花费'+cost+'铜币；阵亡单位不能在医院复活。';return true;
 }
 upgradeError():string{
  const s=this.state;if(s.phase==='defeat')return '城池已失守';if(s.cityLevel>=2)return '营地版本最高为小型营地';const next=TOWN_NODES[s.cityLevel+1];
  if(this.completed<next.minRound)return '先完成第'+next.minRound+'回合';if(s.coins<next.cost)return '升级需要'+next.cost+'铜币';return '';
 }
 upgrade():boolean{const error=this.upgradeError();if(error){this.message=error;return false;}this.state.coins-=TOWN_NODES[this.state.cityLevel+1].cost;this.state.cityLevel++;this.message=this.townName+'建成！'+(this.state.cityLevel===2?'开放三块农田、民兵营和弓手营。':'解锁第一块农田。');return true;}
 placementError(plot:CityCell):string{return farmPlacementError(plot,this.cityRadius,this.plots);}
 buildingCost(kind:PlotKind):number{return BUILDING_DESIGNS.find(b=>b.id===PLOT_BUILDING_IDS[kind])!.cost!;}
 buildingError(kind:PlotKind):string{
  const design=BUILDING_DESIGNS.find(b=>b.id===PLOT_BUILDING_IDS[kind]);
  if(!design)return '未知建筑。';
  const requiredTown=TOWN_NODES.findIndex(t=>t.id===design.unlockTown);
  if(this.state.phase==='defeat')return '城池已失守。';
  if(requiredTown<0||this.state.cityLevel<requiredTown)return '先升级'+TOWN_NODES[Math.max(0,requiredTown)].name+'。';
  const cap=kind==='farm'?this.farmCapacity:design.maxCount??1;
  if(this.plots.filter(p=>p.kind===kind).length>=cap)return '已达到该建筑数量上限。';
  if(this.state.coins<this.buildingCost(kind))return '建设需要'+this.buildingCost(kind)+'铜币。';return '';
 }
 build(kind:PlotKind,cell:CityCell):boolean{
  const s=this.state,cost=this.buildingCost(kind),issue=this.buildingError(kind);
  if(issue){this.message=issue;return false;}
  const error=this.placementError(cell);if(error){this.message=error;return false;}
  const id=Math.max(0,...this.plots.map(p=>p.id))+1;this.plots.push({...cell,id,kind,level:1,timer:0});s.coins-=cost;
  this.syncLegacyFarm();s.buildings=Array.from(new Set([...(s.buildings??[]),...this.plots.filter(p=>p.kind!=='farm').map(p=>PLOT_BUILDING_IDS[p.kind])]));
  this.message=kind==='farm'?'农田开始生产：在线每10秒＋1铜币，迎敌另＋1铜币。':kind==='hospital'?'医院建成，点击医院可在战后付费治疗存活士兵。':'兵营建成，点击该建筑可花钱招募对应士兵。';return true;
 }
 buildFarm(cell:CityCell=DEFAULT_FARM):boolean{return this.build('farm',cell);}
 upgradeFarm(id:number):boolean{
  const p=this.plots.find(p=>p.id===id&&p.kind==='farm');if(!p||p.level>=2||this.state.cityLevel<2||this.state.phase==='defeat')return false;
  const next=FARM_LEVELS[p.level];if(this.state.coins<next.cost)return false;this.state.coins-=next.cost;p.level++;this.syncLegacyFarm();this.message='农田升至'+p.level+'级，每次在线产出与迎敌产出均为'+next.passive+'铜。';return true;
 }
 private syncLegacyFarm():void{const p=this.plots.find(p=>p.kind==='farm');this.state.farm=!!p;if(p){this.state.farmPlot={col:p.col,row:p.row};this.state.farmTime=p.timer;this.state.farmLevel=p.level;}}
 startRound():boolean{
  const s=this.state;if(!['ready','victory','complete'].includes(s.phase)||this.completed>=PLAYABLE_ROUNDS)return false;
  const encounter=ENCOUNTERS[this.completed];
  if(s.cityLevel<encounter.city){this.message='先升级'+TOWN_NODES[encounter.city].name+'，再推进主线。';return false;}
  if(this.completed===1&&!s.farm){this.message='先升级房屋并修建农田，再继续迎敌。';return false;}
  if(this.completed>=8&&!this.plots.some(p=>p.kind==='militiaCamp'||p.kind==='archerCamp')){this.message='先建民兵营或弓手营，为混编作战做好准备。';return false;}
  this.checkpoint=clone(s);s.round=this.completed+1;s.phase='battle';s.focus=0;researchRound(this.research,s.round);
  for(const p of this.plots.filter(p=>p.kind==='farm'))s.coins+=FARM_LEVELS[p.level-1].round+this.modifiers.farmIncome;
  s.pending=[];let slot=0;
  for(const [kind,count] of encounter.groups)for(let i=0;i<count;i++){if(s.round<=4)this.spawnEnemy(kind,slot++,true);else s.pending.push({kind,slot:slot++,delay:(slot-1)*0.65});}
  this.message='第'+s.round+'回合：'+encounter.title+'。主线期间暂停新增野怪，在场野怪不会消失。';return true;
 }
 private spawnEnemy(kind:Kind,slot:number,main:boolean,wave=0):void{
  const side=slot%2===0?1:-1;
  this.state.units.push({id:this.state.nextId++,kind,x:side*(10.5+(slot%3)*.6),y:-3.7+((slot*2.7+this.state.round)%7.4),hp:unitData(kind).hp,cooldown:.5,flash:0,swing:0,target:0,main,wave});
 }
 setFocus(id:number):boolean{if(!this.enemies.some(u=>u.id===id))return false;this.state.focus=id;this.message='已标记全军优先目标。';return true;}
 retry():boolean{if(this.state.phase!=='defeat'||!this.checkpoint)return false;this.state=clone(this.checkpoint);this.checkpoint=null;if(this.state.phase!=='battle'&&!this.wild.active)this.wild.timer=0;this.message='回到战前：本次掉落、收入、建设和损失一并还原。';return true;}
 private tickSpawns(dt:number):void{
  const s=this.state;
  if(s.phase==='battle'){
   for(const p of s.pending??[])p.delay=Math.max(0,p.delay-dt);
   while(s.pending?.length&&s.pending[0].delay<=0&&this.enemies.length<WILD_RULES.maxEnemies){const p=s.pending.shift()!;this.spawnEnemy(p.kind,p.slot,true);}return;
  }
  if(this.completed<WILD_RULES.unlockAfter||this.wild.active||s.phase==='complete')return;
  this.wild.timer+=dt;const interval=this.wild.first?WILD_RULES.firstInterval:WILD_RULES.interval;
  if(this.wild.timer+1e-8<interval)return;
  this.wild.timer=Math.min(this.wild.timer,interval);this.checkpoint=clone(s);this.wild.timer=0;this.wild.first=false;this.wild.active=++this.wild.serial;
  const roster=wildRoster(this.completed,this.wild.serial-1);roster.forEach((kind,i)=>this.spawnEnemy(kind,i,false,this.wild.active));
  this.message=(this.completed>=16?'亡灵':'哥布林')+'野怪来袭！可继续建设，也可迎接主线。';
 }
 private defense(unit:Unit,type:string):number{
  const d=unitData(unit.kind);let value=type==='magic'?d.resistance:d.armor;
  if(allied(unit)&&type!=='magic')value+=this.modifiers.armor[d.job]??0;
  if(!allied(unit)&&type!=='magic'&&d.race==='哥布林'&&this.enemies.some(u=>u.kind==='goblinBoss'&&u.id!==unit.id&&distance(u,unit)<=4))value++;
  return value;
 }
 private chooseTarget(unit:Unit,living:Unit[]):Unit|undefined{
  const d=unitData(unit.kind),opponents=living.filter(u=>allied(u)!==allied(unit));
  const sort=(a:Unit,b:Unit)=>distance(unit,a)-distance(unit,b)||a.id-b.id;
  if(d.job==='护卫'){
   const rear=living.filter(u=>allied(u)===allied(unit)&&unitData(u.kind).range>1);
   const threatened=rear.map(ward=>({ward,attacker:opponents.find(enemy=>enemy.id===ward.lastAttacker&&this.state.elapsed-(ward.attackedAt??-Infinity)<=2)??opponents.filter(enemy=>enemy.target===ward.id).sort(sort)[0]})).filter(pair=>!!pair.attacker);
   threatened.sort((a,b)=>(b.ward.attackedAt??-Infinity)-(a.ward.attackedAt??-Infinity)||sort(a.attacker!,b.attacker!));
   const ward=threatened[0]?.ward??rear.sort((a,b)=>Number(unitData(a.kind).attack<=0)-Number(unitData(b.kind).attack<=0)||sort(a,b))[0];
   unit.protectedBy=ward?.id;
   // 保护响应先于全军集火；下一逻辑帧立即追击真实伤害来源，不站桩等待。
   if(threatened[0])return threatened[0].attacker;
   if(allied(unit)){const focus=opponents.find(u=>u.id===this.state.focus);if(focus)return focus;}
   if(ward){const assassin=opponents.filter(u=>unitData(u.kind).job==='刺客'&&distance(u,ward)<=3).sort(sort)[0];if(assassin)return assassin;}
   return opponents.sort(sort)[0];
  }
  if(allied(unit)){const focus=opponents.find(u=>u.id===this.state.focus);if(focus)return focus;}
  if(d.job==='刺客')return opponents.sort((a,b)=>{
   const rank=(u:Unit)=>unitData(u.kind).job==='辅助'?0:unitData(u.kind).range>1?1:2;return rank(a)-rank(b)||(rank(a)===2?this.defense(a,'physical')-this.defense(b,'physical'):0)||sort(a,b);
  })[0];
  if(d.job==='魔法师'){const heavy=opponents.filter(u=>unitData(u.kind).heavy&&distance(unit,u)<=d.range).sort(sort)[0];if(heavy)return heavy;}
  if(d.job==='弓箭手'){
   const inside=opponents.filter(u=>distance(unit,u)<=d.range);unit.entered??={};
   for(const u of inside)if(unit.entered[u.id]===undefined)unit.entered[u.id]=this.state.elapsed;
   const ids=new Set(inside.map(u=>String(u.id)));for(const key of Object.keys(unit.entered))if(!ids.has(key))delete unit.entered[key];
   const target=inside.sort((a,b)=>unit.entered![a.id]-unit.entered![b.id]||sort(a,b))[0];if(target)return target;
  }
  return opponents.sort(sort)[0];
 }
 private receive(victim:Unit,amount:number,attacker:Unit):void{
  if(amount<=0||victim.hp<=0)return;
  victim.lastAttacker=attacker.id;victim.attackedAt=this.state.elapsed;
  if(unitData(victim.kind).range>1){
   const guard=this.state.units.filter(u=>u.hp>0&&allied(u)===allied(victim)&&unitData(u.kind).job==='护卫'&&u.protectedBy===victim.id&&distance(u,victim)<=3).sort((a,b)=>distance(a,victim)-distance(b,victim)||a.id-b.id)[0];
   if(guard){const share=amount*.3;guard.hp=Math.max(0,guard.hp-share);guard.flash=.15;amount-=share;}
  }
  victim.hp=Math.max(0,victim.hp-amount);victim.flash=.15;
 }
 tick(dt:number):void{
  if(!Number.isFinite(dt)||dt<=0||this.state.phase==='defeat')return;const s=this.state;s.elapsed+=dt;this.tickProduction(dt);this.tickSpawns(dt);
  if(s.cityHp>0)s.cityHp=Math.min(this.maxCityHp,s.cityHp+this.modifiers.cityRegen*dt);
  for(const u of this.guards)if(this.modifiers.unitRegen)u.hp=Math.min(unitData(u.kind).hp,u.hp+this.modifiers.unitRegen*dt);
  const living=s.units.filter(u=>u.hp>0),strikes:{from:Unit;to:Unit|null;amount:number;heal?:boolean}[]=[];
  for(const u of living){
   const d=unitData(u.kind);u.cooldown=Math.max(0,u.cooldown-dt);u.flash=Math.max(0,u.flash-dt);u.swing=Math.max(0,u.swing-dt);
   if(!this.activeCombat){u.target=0;const home=guardPost(u.post!),dist=distance(u,home),step=d.speed*dt;if(dist<=step){u.x=home.x;u.y=home.y;}else{u.x+=(home.x-u.x)/dist*step;u.y+=(home.y-u.y)/dist*step;}continue;}
   if(d.job==='辅助'){
    const friends=living.filter(v=>v.id!==u.id&&allied(v)===allied(u)&&v.hp<unitData(v.kind).hp&&distance(u,v)<=d.range&&(u.kind!=='healerGoblin'||unitData(v.kind).race!=='机械'));
    friends.sort((a,b)=>Number(unitData(a.kind).range>1)-Number(unitData(b.kind).range>1)||(unitData(b.kind).hp-b.hp)-(unitData(a.kind).hp-a.hp)||a.id-b.id);
    if(d.heal>0&&friends[0]&&u.cooldown<=0){strikes.push({from:u,to:friends[0],amount:d.heal+(allied(u)?this.modifiers.healing[d.job]??0:0),heal:true});u.cooldown=1/d.rate;u.swing=.18;}
    const escort=living.filter(v=>allied(v)===allied(u)&&v.id!==u.id).sort((a,b)=>Number(unitData(a.kind).range<=1)-Number(unitData(b.kind).range<=1)||distance(a,u)-distance(b,u))[0];
    if(escort&&distance(u,escort)>2){const dist=distance(u,escort),move=Math.min(d.speed*dt,dist-2);u.x+=(escort.x-u.x)/dist*move;u.y+=(escort.y-u.y)/dist*move;}continue;
   }
   const target=this.chooseTarget(u,living);let tx=target?.x??0,ty=target?.y??0,dist=target?distance(u,target):Infinity,targetId=target?.id??0,range=d.range;
   if(!allied(u)&&u.kind!=='headlessKnight'){
    const cityDist=Math.hypot(u.x,u.y);if(d.job==='攻城'||cityDist-RULES.cityRadius<dist){tx=0;ty=0;dist=cityDist;range+=RULES.cityRadius;targetId=-1;}
   }
   if(!targetId)continue;u.target=targetId;
   if(dist>range){const move=Math.min(d.speed*dt,dist-range+.001);u.x+=(tx-u.x)/dist*move;u.y+=(ty-u.y)/dist*move;}
   else if(u.cooldown<=0){
    let attack=d.attack+(allied(u)?this.modifiers.attack[d.job]??0:0);
    if(target&&d.job==='护卫'&&unitData(target.kind).job==='刺客')attack*=1.3;
    if(targetId===-1&&d.job==='攻城')attack*=1.5;
    strikes.push({from:u,to:targetId===-1?null:target!,amount:damage(attack,targetId===-1?0:this.defense(target!,d.type))});u.cooldown=1/d.rate;u.swing=.18;
   }
  }
  for(let i=0;i<living.length;i++)for(let j=i+1;j<living.length;j++){
   const a=living[i],b=living[j];if(allied(a)!==allied(b))continue;const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(len>.001&&len<.6){const push=Math.min((.6-len)/2,dt*.7);a.x-=dx/len*push;a.y-=dy/len*push;b.x+=dx/len*push;b.y+=dy/len*push;}
  }
  for(const hit of strikes){if(!hit.to)s.cityHp=Math.max(0,s.cityHp-hit.amount);else if(hit.heal){if(hit.to.hp>0)hit.to.hp=Math.min(unitData(hit.to.kind).hp,hit.to.hp+hit.amount);}else this.receive(hit.to,hit.amount,hit.from);}
  for(const u of s.units)if(u.hp<=0&&!allied(u))s.coins+=unitData(u.kind).drop;
  s.units=s.units.filter(u=>u.hp>0);if(!this.enemies.some(u=>u.id===s.focus))s.focus=0;
  // 先判负，避免城破同帧最后敌人死亡时同时领取胜利奖励。
  if(s.cityHp<=0){s.phase='defeat';this.message='城池被攻破，可回到战前重新部署。';return;}
  if(this.wild.active&&!this.enemies.some(u=>u.wave===this.wild.active)){
   const points=this.rewardWildWave('wild:'+this.wild.active);this.wild.active=0;this.wild.timer=0;this.message='野怪整波已击退，'+(points?'研究点＋'+points+'；':'')+'驻军正在归位。';
  }
  if(s.phase==='battle'&&!this.enemies.length&&!s.pending?.length){
   s.completed=s.round;s.phase=s.round>=PLAYABLE_ROUNDS?'complete':'victory';s.focus=0;
   for(const u of this.guards){u.target=0;u.swing=0;}
   if(!s.kingPaid){s.kingPaid=true;s.coins+=50;this.message='首战告捷！击杀3铜币，国王另送50铜币。进入主城升级。';}
   else{s.coins+=ENCOUNTERS[s.round-1].reward;this.message='守住第'+s.round+'回合，主线赏金＋'+ENCOUNTERS[s.round-1].reward+'铜币。';}
   if(s.round===16){s.goblinBossDefeated=true;this.message='哥布林头领倒下，白骨大军正在平原集结。营地版本完成，亡灵主线将在下一里程碑开放。';}
  }
 }
 tickProduction(dt:number):void{
  if(!Number.isFinite(dt)||dt<=0||this.state.phase==='defeat')return;const mods=this.modifiers;
  // 老接口中的首田计时仍接受旧调用方更新，存档迁移不重复补产。
  const first=this.plots.find(p=>p.kind==='farm');if(first){first.timer=this.state.farmTime;first.level=this.state.farmLevel??first.level;}
  for(const p of this.plots.filter(p=>p.kind==='farm')){const base=FARM_LEVELS[p.level-1],period=Math.max(1,base.seconds-mods.farmPeriod);p.timer+=dt;const n=Math.floor((p.timer+1e-8)/period);if(n){this.state.coins+=n*(base.passive+mods.farmIncome);p.timer=Math.max(0,p.timer-n*period);}}
  this.syncLegacyFarm();tickResearch(this.research,dt);
 }
 save():SaveData{return {state:clone(this.state),checkpoint:clone(this.checkpoint)};}
 static load(raw:unknown):BattleModel|null{
  if(!raw||typeof raw!=='object')return null;const data=clone(raw) as SaveData;
  const valid=(s:Snapshot):boolean=>{
   if(!s||s.version!==1||!['ready','battle','victory','defeat','complete'].includes(s.phase))return false;
   if(!Number.isInteger(s.round)||s.round<0||s.round>PLAYABLE_ROUNDS||!Number.isInteger(s.coins)||s.coins<0||s.coins>1e12)return false;
   if(![0,1,2].includes(s.cityLevel)||typeof s.farm!=='boolean'||typeof s.kingPaid!=='boolean')return false;
   if(s.technologies!==undefined&&!validTechnologyLevels(s.technologies))return false;
   if(s.farmLevel!==undefined&&(!Number.isInteger(s.farmLevel)||s.farmLevel<1||s.farmLevel>3))return false;
   if(s.buildings!==undefined&&(!Array.isArray(s.buildings)||s.buildings.length>30||s.buildings.some(id=>typeof id!=='string')))return false;
   if(!Number.isFinite(s.cityHp)||s.cityHp<0||s.cityHp>TOWN_NODES[s.cityLevel].hp+technologyModifiers(s.technologies??{}).cityHp)return false;
   if(s.research!==undefined&&(!validResearchState(s.research)||s.research.lastRound!==s.round))return false;
   if(s.farmPlot!==undefined&&(!s.farm||farmPlacementError(s.farmPlot,s.cityLevel>=2?6:4)))return false;
   if(!Number.isFinite(s.farmTime)||s.farmTime<0||s.farmTime>=10||!Number.isFinite(s.elapsed)||s.elapsed<0)return false;
   if(!Number.isSafeInteger(s.nextId)||s.nextId<1||!Number.isInteger(s.focus))return false;
   if(!Array.isArray(s.units)||s.units.length>64||s.units.some(u=>!u||!(u.kind in UNIT_DATA))||new Set(s.units.map(u=>u.id)).size!==s.units.length)return false;
   const posts=s.units.filter(u=>allied(u)&&u.post!==undefined).map(u=>u.post);if(posts.some(p=>!Number.isInteger(p)||p!<0||p!>=8)||new Set(posts).size!==posts.length||s.units.filter(allied).length>8)return false;
   if(!s.units.every(u=>Number.isSafeInteger(u.id)&&u.id>0&&u.id<s.nextId&&Number.isFinite(u.x)&&Math.abs(u.x)<30&&Number.isFinite(u.y)&&Math.abs(u.y)<20&&Number.isFinite(u.hp)&&u.hp>0&&u.hp<=unitData(u.kind).hp&&[u.cooldown,u.flash,u.swing].every(v=>Number.isFinite(v)&&v>=0)&&Number.isInteger(u.target)))return false;
   if(s.units.some(u=>(u.lastAttacker!==undefined&&(!Number.isSafeInteger(u.lastAttacker)||u.lastAttacker<1||u.lastAttacker>=s.nextId))||(u.attackedAt!==undefined&&(!Number.isFinite(u.attackedAt)||u.attackedAt<0||u.attackedAt>s.elapsed))))return false;
   if(s.completed!==undefined&&(!Number.isInteger(s.completed)||s.completed<0||s.completed>s.round))return false;
   if(s.wild!==undefined&&(!Number.isFinite(s.wild.timer)||s.wild.timer<0||s.wild.timer>60||!Number.isSafeInteger(s.wild.serial)||s.wild.serial<0||!Number.isSafeInteger(s.wild.active)||s.wild.active<0||s.wild.active>s.wild.serial||typeof s.wild.first!=='boolean'))return false;
   if(s.pending!==undefined&&(!Array.isArray(s.pending)||s.pending.length>40||s.pending.some(p=>!p||!(p.kind in UNIT_DATA)||unitData(p.kind).side!=='enemy'||!Number.isFinite(p.delay)||p.delay<0||!Number.isInteger(p.slot)||p.slot<0||p.slot>40)))return false;
   if(s.plots!==undefined){
    if(!Array.isArray(s.plots)||s.plots.length>30||new Set(s.plots.map(p=>p?.id)).size!==s.plots.length)return false;
    const checked:CityCell[]=[];for(const p of s.plots){if(!p||!Number.isInteger(p.id)||p.id<1||!['farm','militiaCamp','archerCamp','hospital'].includes(p.kind)||!Number.isInteger(p.level)||p.level<1||p.level>3||!Number.isFinite(p.timer)||p.timer<0||p.timer>=10||farmPlacementError(p,s.cityLevel>=2?6:4,checked))return false;checked.push(p);}
    for(const kind of ['militiaCamp','archerCamp','hospital'])if(s.plots.filter(p=>p.kind===kind).length>1)return false;
    const first=s.plots.find(p=>p.kind==='farm');if(!!first!==s.farm)return false;
    if(first&&s.farmPlot&&(first.col!==s.farmPlot.col||first.row!==s.farmPlot.row))return false;
   }
   return true;
  };
  if(!valid(data.state)||(data.checkpoint!==null&&(!valid(data.checkpoint)||!['ready','victory','complete'].includes(data.checkpoint.phase))))return null;
  if(['battle','defeat'].includes(data.state.phase)&&!data.checkpoint)return null;
  const m=new BattleModel();m.state=data.state;m.checkpoint=data.checkpoint;
  for(const s of [m.state,m.checkpoint]){
   if(!s)continue;
   s.completed??=['victory','complete'].includes(s.phase)?s.round:Math.max(0,s.round-1);
   if(s.phase==='complete'&&s.round<PLAYABLE_ROUNDS)s.phase='victory';
   if(!s.research)s.research=newResearchState(s.round);
   if(s.farm&&!s.farmPlot){const p=s.plots?.find(p=>p.kind==='farm');s.farmPlot=p?{col:p.col,row:p.row}:{...DEFAULT_FARM};}
   // v0.1.x的farmPlot是首田位置；以它修复首田镜像，不重扣建设费。
   if(s.plots&&s.farm){const first=s.plots.find(p=>p.kind==='farm');if(first){first.col=s.farmPlot!.col;first.row=s.farmPlot!.row;}}
   const occupied=new Set(s.units.filter(u=>allied(u)&&u.post!==undefined).map(u=>u.post));for(const u of s.units.filter(u=>allied(u)&&u.post===undefined)){let post=0;while(occupied.has(post))post++;u.post=post;occupied.add(post);}
   s.wild??={timer:0,serial:0,active:0,first:true};s.pending??=[];
  }
  m.message='已恢复第'+m.state.round+'回合的开拓进度。'+(m.state.phase==='battle'?'城外战斗继续。':m.state.phase==='defeat'?'城池已失守，可回到战前。':'可以建设、补员或继续迎敌。');return m;
 }
}
