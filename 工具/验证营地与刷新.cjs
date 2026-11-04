const assert=require('node:assert/strict'),path=require('node:path');
const out=path.resolve(process.argv[2]),{BattleModel}=require(path.join(out,'战斗/BattleModel.js')),{unitData}=require(path.join(out,'数据/UnitData.js')),{ENCOUNTERS,wildRoster}=require(path.join(out,'战斗/MonsterWaves.js'));
const tick=(m,seconds)=>{for(let i=0;i<Math.round(seconds*30);i++)m.tick(1/30);};
function battle(m,focus=true){for(let i=0;i<180*30&&m.state.phase==='battle';i++){
 const priority=focus&&(m.enemies.find(u=>u.kind==='siegeGoblin')??m.enemies.find(u=>u.kind==='goblinBoss')??m.enemies.find(u=>u.kind==='healerGoblin')??m.enemies.find(u=>u.kind==='mageGoblin'));if(priority)m.setFocus(priority.id);m.tick(1/30);
}}
function ready(round=2){const m=new BattleModel();Object.assign(m.state,{round,completed:round,cityLevel:1,coins:100,phase:'victory',kingPaid:true});m.research.lastRound=round;assert(m.buildFarm());return m;}
assert.equal(ENCOUNTERS.length,32);assert(ENCOUNTERS.slice(0,16).every(w=>w.faction==='goblin'));assert(ENCOUNTERS.slice(16).every(w=>w.faction==='undead'));
assert(ENCOUNTERS[15].groups.some(g=>g[0]==='goblinBoss'));assert(ENCOUNTERS[31].groups.some(g=>g[0]==='headlessKnight'));
assert(wildRoster(15,0).every(k=>unitData(k).faction==='goblin'));assert(wildRoster(16,0).every(k=>unitData(k).faction==='undead'));
// 野怪在整备时实际刷新，主线迎敌保留原敌人；时钟、波次身份及存档不重置。
const wild=ready();tick(wild,59.9);assert.equal(wild.enemies.length,0);tick(wild,.1);assert(wild.enemies.length>0);assert.equal(wild.wild.active,1);
const wildIds=wild.enemies.map(u=>u.id),wildPoints=wild.research.points,restored=BattleModel.load(wild.save());assert(restored,'野怪交战可恢复');
assert(wild.startRound());assert(wildIds.every(id=>wild.enemies.some(u=>u.id===id)));
const serial=wild.wild.serial;tick(wild,.1);assert.equal(wild.wild.serial,serial,'主线期间不新增野怪');
assert(BattleModel.load(wild.save()));battle(wild);assert.equal(wild.state.phase,'victory');assert.equal(wild.research.points,wildPoints,'未建研究塔，回合和野怪都不产点');assert.equal(wild.wild.active,0);
const points=wild.research.points;tick(wild,10);assert.equal(wild.research.points,points,'波次奖励不重复');
const alone=ready();tick(alone,60);alone.state.cityHp=0;alone.tick(1/30);assert.equal(alone.state.phase,'defeat');assert(alone.retry());assert.equal(alone.wild.timer,0);assert.equal(alone.enemies.length,0,'独立野怪失败回到生成前并留出重新整备时间');
// 建筑位置、数量、升级与每块田独立收入。
const city=ready(8);city.state.coins=1000;assert(city.upgrade());assert.equal(city.armyCapacity,8);assert.equal(city.maxCityHp,200);assert.equal(city.state.cityHp,100,'升级不自动恢复耐久');
assert(city.buildFarm({col:-4,row:2}));assert(city.buildFarm({col:2,row:2}));const balance=city.state.coins;assert(!city.buildFarm({col:-6,row:2}));assert.equal(city.state.coins,balance);
assert(!city.build('archerCamp',{col:-4,row:2}));assert(city.build('archerCamp',{col:-4,row:-4}));assert(city.build('militiaCamp',{col:2,row:-4}));
assert(city.upgradeFarm(city.plots.find(p=>p.kind==='farm').id));const before=city.state.coins;city.tickProduction(10);assert.equal(city.state.coins-before,4,'2+1+1田收入叠加');assert(BattleModel.load(city.save()));
assert(city.recruit('archer'));assert(city.recruit('militia'));assert(city.repairCity());assert.equal(city.state.cityHp,200);assert.equal(city.repairCost,0);
// 连续16回合：不加资源、不等挂机、不靠广告；按实际费用招募/建造/修缮，首领战调整编队。
const m=new BattleModel();
for(let round=1;round<=16;round++){
 if(round===2){assert(m.upgrade());assert(m.buildFarm());assert(m.build('hospital',{col:-4,row:-4}));}
 if(round===9){assert(m.state.coins>=230,'主线资金足以支付营地和两兵营');assert(m.upgrade());assert(m.build('militiaCamp',{col:-4,row:2}));assert(m.build('archerCamp',{col:2,row:-4}));}
 if(round>1){m.repairCity();if(m.treatmentCost())assert(m.treat(),'可以用正常收入治疗残血，不靠解散重招');}
 while(m.guards.length<m.armyCapacity&&m.state.coins){const count=k=>m.guards.filter(u=>u.kind===k).length,kind=m.state.cityLevel===2?(count('archer')<3?'archer':count('militia')<3?'militia':'guard'):'guard';if(!m.recruit(kind)&&!m.recruit())break;}
 if(round===16){for(const u of [...m.guards])assert(m.dismiss(u.id));for(let i=0;i<6;i++)assert(m.recruit('archer'));for(let i=0;i<2;i++)assert(m.recruit('militia'));}
 assert(m.startRound());if(round>4)assert(m.state.pending.length>0,'较大波次分批入场');battle(m);assert.notEqual(m.state.phase,'defeat','第'+round+'回合');assert.equal(m.completed,round);assert(BattleModel.load(m.save()),'每回合存档可恢复');
}
assert.equal(m.state.phase,'complete');assert(m.state.goblinBossDefeated);assert(!m.startRound());
const old=ready(4).save();old.state.phase='complete';delete old.state.completed;delete old.state.wild;delete old.state.pending;delete old.state.plots;
const migrated=BattleModel.load(old);assert(migrated);assert.equal(migrated.state.phase,'victory');assert.equal(migrated.completed,4);assert(migrated.startRound());
const bad=city.save();bad.state.plots[1].col=bad.state.plots[0].col;bad.state.plots[1].row=bad.state.plots[0].row;assert.equal(BattleModel.load(bad),null);
// 护卫分摊总伤害只结算一次，反刺客倍率真实生效。
function arena(){const a=new BattleModel();a.checkpoint=a.save().state;a.state.phase='battle';a.state.round=1;a.research.lastRound=1;a.state.units=[];return a;}
function unit(a,kind,x,y,cooldown=0){const d=unitData(kind),u={id:a.state.nextId++,kind,x,y,hp:d.hp,cooldown,flash:0,swing:0,target:0};if(d.side==='ally')u.post=a.guards.length;a.state.units.push(u);return u;}
const protect=arena(),guard=unit(protect,'guard',6,0),archer=unit(protect,'archer',6.3,0,1),wolf=unit(protect,'wolf',6.3,.1);
protect.tick(.01);assert(Math.abs(wolf.hp-1.4)<1e-6,'护卫对刺客额外30%');assert(Math.abs(guard.hp-14.4)<1e-6);assert(Math.abs(archer.hp-13.6)<1e-6,'伤害70/30，合计不变');
const magic=arena();magic.state.technologies={T008:5};const tank=unit(magic,'guard',6,0,1);unit(magic,'mageGoblin',6,1);magic.tick(.01);assert.equal(tank.hp,12,'魔法无视护卫护甲强化');
const waiting=ready(4);assert(waiting.startRound());waiting.state.units=waiting.guards;waiting.state.pending=[{kind:'goblin',slot:0,delay:2}];waiting.tick(.1);assert.equal(waiting.state.phase,'battle','尚未入场的怪物阻止提前判胜');
const heal=arena(),doctor=unit(heal,'healerGoblin',6,0),machine=unit(heal,'siegeGoblin',6,.5),wounded=unit(heal,'goblin',6.5,0);doctor.hp=10;machine.hp=60;wounded.hp=5;heal.tick(.01);assert.equal(doctor.hp,10,'医师不自疗');assert.equal(machine.hp,60,'不治疗机械');assert.equal(wounded.hp,8,'按表每次治疗3');
console.log('营地与刷新验证通过：16回合无广告/无挂机资金闭环、多田/兵营/修缮、野怪实刷、主野怪共存、奖励隔离、防重复、旧档和位置存档。');
