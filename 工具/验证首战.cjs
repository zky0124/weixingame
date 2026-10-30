const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const assets = path.resolve(__dirname, '../游戏工程/assets');
const uuids = new Set();
function checkMetas(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.endsWith('.meta')) continue;
    const full = path.join(dir, entry.name);
    assert(fs.existsSync(full + '.meta'), '资源缺少meta：' + full);
    const meta = JSON.parse(fs.readFileSync(full + '.meta', 'utf8'));
    assert(!uuids.has(meta.uuid), '资源UUID重复'); uuids.add(meta.uuid);
    if (entry.isDirectory()) checkMetas(full);
  }
}
checkMetas(assets);
const { BattleModel, damage, guardPost } = require(path.resolve(process.argv[2], '战斗/BattleModel.js'));
const { project, unproject, farmPlacementError, DEFAULT_FARM } = require(path.resolve(process.argv[2], '城市/CityLayout.js'));
for (let col = -4; col <= 4; col++) for (let row = -4; row <= 4; row++) {
  const point = project(col + 0.5, row + 0.5);
  assert.deepEqual(unproject(point.x, point.y), { col, row }, '网格投影与点击反解应一致');
}
const tick = (m, seconds) => { for (let i = 0; i < Math.round(seconds * 30); i++) m.tick(1 / 30); };
const battle = m => { for (let i = 0; i < 90 * 30 && m.state.phase === 'battle'; i++) m.tick(1 / 30); };
const m = new BattleModel();
assert.equal(m.guards.length, 3); assert.equal(m.state.coins, 0);
assert.equal(damage(10, 1), 9); assert.equal(damage(10, -3), 13); assert.equal(damage(1, 3), 0);
assert(m.startRound()); assert(!m.startRound()); assert.equal(m.enemies.length, 3);
tick(m, 3);
const resumed = BattleModel.load(m.save()); assert(resumed);
battle(m); battle(resumed);
assert.equal(m.state.phase, 'victory'); assert.equal(m.state.coins, 53);
assert.deepEqual(resumed.state, m.state, '交战中保存恢复应产生相同结果');
const postHp = m.guards.map(u => [u.id, u.hp]);
const clearedAt = m.state.elapsed;
tick(m, 20); assert.equal(m.state.coins, 53, '不重复发首胜奖励');
assert(m.state.elapsed > clearedAt, '战后世界时钟仍运行');
assert(m.guards.every(u => Math.hypot(u.x - guardPost(u.post).x, u.y - guardPost(u.post).y) < 1e-6), '战后步行回到各自原始驻守点');
assert(m.guards.every(u => u.target === 0 && u.swing === 0), '回位后不残留攻击目标或攻击动作');
assert.deepEqual(m.guards.map(u => [u.id, u.hp]), postHp, '回位不复活、不免费回血');
assert(!m.startRound(), '教学应先建设'); assert(m.upgrade()); assert(!m.upgrade());
assert.equal(m.state.coins, 23); assert(m.buildFarm()); assert(!m.buildFarm()); assert.equal(m.state.coins, 18);
const town = new BattleModel(); town.state.cityLevel = 1; town.state.coins = 10;
for (const cell of [{ col: -1, row: -1 }, { col: 1, row: -3 }, { col: 4, row: 4 }, { col: 2.5, row: -2 }]) {
  assert(farmPlacementError(cell)); assert(!town.buildFarm(cell));
  assert.equal(town.state.coins, 10, '无效选址不得扣费'); assert(!town.state.farm);
}
const customPlot = { col: -4, row: 2 };
assert(town.buildFarm(customPlot)); assert.equal(town.state.coins, 5);
assert.deepEqual(town.state.farmPlot, customPlot);
const townRestored = BattleModel.load(town.save()); assert(townRestored);
assert.deepEqual(townRestored.state.farmPlot, customPlot, '建成位置应保存恢复');
assert(!townRestored.buildFarm(DEFAULT_FARM)); assert.equal(townRestored.state.coins, 5);
const oldTown = town.save(); delete oldTown.state.farmPlot;
const oldTownRestored = BattleModel.load(oldTown); assert(oldTownRestored);
assert.deepEqual(oldTownRestored.state.farmPlot, DEFAULT_FARM); assert.equal(oldTownRestored.state.coins, 5);
const badTown = town.save(); badTown.state.farmPlot = { col: 0, row: 0 };
assert.equal(BattleModel.load(badTown), null, '拒绝与主城重叠的损坏建筑位置');
tick(m, 10); assert.equal(m.state.coins, 19);
assert(m.startRound()); assert.equal(m.state.coins, 20, '迎敌和在线收入叠加');
assert(m.setFocus(m.enemies[0].id));
tick(m, 1 / 30); assert(m.guards.every(u => u.target === m.state.focus), '全军应优先追击集火目标');
tick(m, 10); assert(m.state.coins >= 21, '交战期间农田仍产出');
battle(m);
while (m.state.round < 4) {
  while (m.guards.length < m.armyCapacity && m.state.coins) m.recruit();
  assert(m.startRound()); battle(m); assert.notEqual(m.state.phase, 'defeat');
}
assert.equal(m.state.phase, 'complete'); assert(!m.startRound());
tick(m, 15);
assert(m.guards.every(u => Math.hypot(u.x - guardPost(u.post).x, u.y - guardPost(u.post).y) < 1e-6), '最后一波结束也继续回位');
const legacy = m.save();
for (const state of [legacy.state, legacy.checkpoint]) if (state) for (const unit of state.units) delete unit.post;
const migrated = BattleModel.load(legacy); assert(migrated);
assert.equal(migrated.state.coins, legacy.state.coins); assert.equal(migrated.state.round, legacy.state.round);
assert.deepEqual(migrated.guards.map(u => u.hp), m.guards.map(u => u.hp));
assert.equal(new Set(migrated.guards.map(u => u.post)).size, migrated.guards.length, '旧存档自动补唯一驻守位');
const slots = new BattleModel(); slots.state.coins = 10;
const survivorSlots = slots.guards.slice(1).map(u => [u.id, u.post]);
slots.state.units = slots.guards.slice(1); assert(slots.recruit());
assert.deepEqual(slots.guards.slice(0, 2).map(u => [u.id, u.post]), survivorSlots, '补员不改存活者原来的驻守位');
assert.equal(slots.guards[2].post, 0, '新护卫补空位');
const midReturn = new BattleModel(); midReturn.state.phase = 'victory'; midReturn.state.round = 1;
midReturn.research.lastRound = 1;
midReturn.guards[0].x = 9; tick(midReturn, 0.5);
assert(midReturn.guards[0].x < 9 && midReturn.guards[0].x > guardPost(0).x, '回位应渐进移动而非瞬移');
const restoredReturn = BattleModel.load(midReturn.save()); assert(restoredReturn);
tick(midReturn, 5); tick(restoredReturn, 5); assert.deepEqual(restoredReturn.state, midReturn.state, '回位过程中保存恢复一致');
const f = new BattleModel(); f.startRound(); f.state.units = f.enemies; f.state.cityHp = 1;
battle(f); assert.equal(f.state.phase, 'defeat');
const savedFailure = BattleModel.load(f.save()); assert(savedFailure); assert(savedFailure.retry());
assert.equal(savedFailure.state.round, 0); assert.equal(savedFailure.state.coins, 0); assert.equal(savedFailure.guards.length, 3);
assert.equal(savedFailure.state.cityHp, 100); assert(!savedFailure.retry());
const bad = m.save(); bad.state.coins = -100; assert.equal(BattleModel.load(bad), null);
const duplicated = m.save(); duplicated.state.units.push(duplicated.state.units[0]); assert.equal(BattleModel.load(duplicated), null);
const nullUnit = m.save(); nullUnit.state.units.push(null); assert.equal(BattleModel.load(nullUnit), null);
assert.equal(BattleModel.load({}), null); assert.equal(BattleModel.load(null), null);
console.log('验证通过：经济与4回合、回位/旧存档、网格投影、建筑占地/扣费/位置存档、失败回滚及防重复奖励。');
