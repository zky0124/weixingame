const assert=require('node:assert/strict'),path=require('node:path');
const out=path.resolve(process.argv[2]),T=require(path.join(out,'城市/TechnologySystem.js')),
 {TECHNOLOGIES}=require(path.join(out,'城市/TechnologyData.js')),{BattleModel}=require(path.join(out,'战斗/BattleModel.js'));
const context={hasTower:true,town:3,farmLevel:3,buildings:['B006','B008']};
let levels={},wallet={points:100000,coins:100000};
assert.equal(TECHNOLOGIES.length,18);
assert.match(T.purchaseTechnology(levels,'T006',wallet,context),/尚未填写/);
assert.match(T.purchaseTechnology(levels,'T003',wallet,context),/前置/);
for(let i=0;i<5;i++)assert.equal(T.purchaseTechnology(levels,'T001',wallet,context),'');
assert.equal(wallet.points,99950);assert.equal(T.technologyModifiers(levels).attack['战士'],5);
assert.equal(T.technologyModifiers(levels).attack['魔法师'],undefined);
assert.match(T.purchaseTechnology(levels,'T001',wallet,context),/满级/);
assert.equal(T.purchaseTechnology(levels,'T003',wallet,context),'');
assert(T.technologyModifiers(levels).unlockedUnits.includes('熟练民兵'));
// 真正走跨路线执行逻辑，临时给编译产物增加法师路线前置，结束后还原。
const node=TECHNOLOGIES.find(n=>n.id==='T003'),prior=node.prerequisites;
try{node.prerequisites=[...prior,{id:'T002',level:1}];delete levels.T003;
 assert.match(T.purchaseTechnology(levels,'T003',wallet,context),/前置/);
 assert.equal(T.purchaseTechnology(levels,'T002',wallet,context),'');
 assert.equal(T.purchaseTechnology(levels,'T003',wallet,context),'');
}finally{node.prerequisites=prior;}
levels={T014:1,T015:3};wallet={points:500,coins:999};
assert.match(T.purchaseTechnology(levels,'T016',wallet,context),/铜币/);assert.deepEqual(wallet,{points:500,coins:999});assert.equal(levels.T016,undefined);
wallet.coins=1000;assert.equal(T.purchaseTechnology(levels,'T016',wallet,context),'');assert.deepEqual(wallet,{points:0,coins:0});
const all=Object.fromEntries(TECHNOLOGIES.map(n=>[n.id,n.maxLevel]));const mods=T.technologyModifiers(all);
assert.equal(mods.attack['魔法师'],10);assert.equal(mods.attack['弓箭手'],5);assert.equal(mods.armor['护卫'],5);
assert.equal(mods.farmCapacity,1);assert.equal(mods.farmPeriod,2);assert.equal(mods.farmIncome,3);
assert.equal(mods.cityHp,50);assert.equal(mods.cityRegen,3);assert.equal(mods.unitRegen,1);assert.equal(mods.healing['辅助'],1);assert.equal(mods.researchTier,2);
const m=new BattleModel();m.research.towerBuilt=true;m.research.points=1000;m.research.timer=15;
assert.equal(m.researchTechnology('T014'),'');assert.equal(m.research.timer,10,'改周期保留半周期进度');
assert.equal(m.researchTechnology('T015'),'');m.tickProduction(10);assert.equal(m.research.points,882,'20秒周期，每次产出2');
assert.equal(m.rewardWildWave('wave'),2);assert.equal(m.rewardWildWave('wave'),0);m.startRound();assert.equal(m.research.points,890,'推进回合获得6');
assert.equal(BattleModel.load(m.save()).research.points,890);
m.state.farm=true;m.state.farmLevel=3;m.state.technologies={T010:1,T011:3,T012:1,T013:3};m.state.cityHp=50;
const before=m.state.coins;m.tickProduction(8);assert.equal(m.state.coins-before,6);assert.equal(m.maxCityHp,150);
assert.equal(m.state.cityHp,50,'建科技不凭空治满城池');
console.log('18项科技效果验证通过：等级/职业/前置合流、资源原子扣除、空白费用、研究周期与全部收入加成、农田、城池及存档。');
