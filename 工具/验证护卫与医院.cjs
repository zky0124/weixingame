const assert=require('node:assert/strict'),path=require('node:path');
const out=path.resolve(process.argv[2]),{BattleModel}=require(path.join(out,'战斗/BattleModel.js')),{unitData}=require(path.join(out,'数据/UnitData.js'));
function arena(){const m=new BattleModel();m.checkpoint=m.save().state;Object.assign(m.state,{phase:'battle',round:1,units:[]});m.research.lastRound=1;return m;}
function add(m,kind,x,y,cooldown=100){const d=unitData(kind),u={id:m.state.nextId++,kind,x,y,hp:d.hp,cooldown,flash:0,swing:0,target:0};if(d.side==='ally')u.post=m.guards.length;m.state.units.push(u);return u;}
// 后排安全时，护卫主动向远离后排的敌人前进，不能驻足等敌人接近。
const advance=arena(),guard=add(advance,'guard',6,0);add(advance,'archer',0,0);const enemy=add(advance,'goblin',8,0);
advance.tick(.1);assert(guard.x>6);assert.equal(guard.target,enemy.id);
// 后排真实受伤后，即使全军集火另一个目标，下一帧也应转向伤害来源。
const rescue=arena(),g=add(rescue,'guard',6,0),front=add(rescue,'goblin',7.1,0),back=add(rescue,'archer',6,4),ranged=add(rescue,'stoneGoblin',6,5,0);
rescue.setFocus(front.id);rescue.tick(.01);assert(back.hp<unitData('archer').hp);assert.equal(back.lastAttacker,ranged.id);
const beforeY=g.y;rescue.tick(.01);assert.equal(g.target,ranged.id);assert(g.y>beforeY,'主动回援，保护普通远程伤害而非只处理刺客');assert.equal(g.protectedBy,back.id);
const restored=BattleModel.load(rescue.save());assert(restored,'威胁记忆可保存');restored.tick(.01);assert.equal(restored.guards.find(u=>u.kind==='guard').target,ranged.id);
rescue.state.units=rescue.state.units.filter(u=>u.id!==ranged.id);rescue.tick(.01);assert.equal(g.target,front.id,'攻击者死亡后恢复有效集火，不追尸体');
// 房屋阶段即可建医院；重复建筑、满血治疗、缺钱/交战失败均不扣费。
const city=new BattleModel();Object.assign(city.state,{phase:'victory',round:1,completed:1,kingPaid:true,cityLevel:1,coins:50});city.research.lastRound=1;
const h={col:-4,row:-4};assert(city.build('hospital',h));assert.equal(city.state.coins,35);assert(city.hasHospital);assert(!city.recruit('medic'),'医院提前不等于提前解锁医疗兵');
const balance=city.state.coins;assert(!city.build('hospital',{col:2,row:2}));assert.equal(city.state.coins,balance);
assert(!city.treat());assert.equal(city.state.coins,balance);
city.guards[0].hp=5;city.guards[1].hp=5;assert.equal(city.treatmentCost(),1,'20缺血合并仅收1铜');assert(city.treat());assert.equal(city.state.coins,balance-1);assert(city.guards.every(u=>u.hp===15));
city.guards[0].hp=4;const other=city.guards[1];other.hp=3;assert(city.treat(city.guards[0].id));assert.equal(other.hp,3,'单人治疗不影响别人');
city.state.coins=0;assert(!city.treat());assert.equal(other.hp,3);city.state.coins=100;
const attacker=add(city,'goblin',10,0);assert(!city.treat());assert.equal(city.state.coins,100,'野怪交战也不能通过医院即时回血');city.state.units=city.state.units.filter(u=>u.id!==attacker.id);
assert(city.treat());const surviving=city.guards.length;city.state.units=city.state.units.filter(u=>u.id!==city.guards[0].id);city.treat();assert.equal(city.guards.length,surviving-1,'医院不会复活阵亡者');assert(BattleModel.load(city.save()));
// 完整存档拒绝第二座同种功能建筑，而不同兵营各允许一座。
const bad=city.save();bad.state.plots.push({id:2,kind:'hospital',col:2,row:2,level:1,timer:0});assert.equal(BattleModel.load(bad),null);
Object.assign(city.state,{cityLevel:2,completed:8,round:8});city.research.lastRound=8;
assert(city.build('archerCamp',{col:2,row:2}));const c=city.state.coins;assert(!city.build('archerCamp',{col:2,row:-4}));assert.equal(city.state.coins,c);assert(city.build('militiaCamp',{col:2,row:-4}));assert(BattleModel.load(city.save()));
console.log('护卫与医院验证通过：主动迎敌、后排受伤优先回援、威胁存档、单座限制、前期医院、单人/全队治疗、拒绝交战/缺钱/满血扣费、禁止复活与提前招医。');
