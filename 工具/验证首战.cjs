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
const { BattleModel, damage } = require(path.resolve(process.argv[2], '战斗/BattleModel.js'));
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
tick(m, 20); assert.equal(m.state.coins, 53, '不重复发首胜奖励');
assert(!m.startRound(), '教学应先建设'); assert(m.upgrade()); assert(!m.upgrade());
assert.equal(m.state.coins, 23); assert(m.buildFarm()); assert(!m.buildFarm()); assert.equal(m.state.coins, 18);
tick(m, 10); assert.equal(m.state.coins, 19);
assert(m.startRound()); assert.equal(m.state.coins, 20, '迎敌和在线收入叠加');
assert(m.setFocus(m.enemies[0].id));
tick(m, 1 / 30); assert(m.guards.every(u => u.target === m.state.focus), '全军应优先追击集火目标');
tick(m, 10); assert(m.state.coins >= 21, '交战期间农田仍产出');
battle(m);
while (m.state.round < 4) {
  while (m.guards.length < 8 && m.state.coins) m.recruit();
  assert(m.startRound()); battle(m); assert.notEqual(m.state.phase, 'defeat');
}
assert.equal(m.state.phase, 'complete'); assert(!m.startRound());
const f = new BattleModel(); f.startRound(); f.state.units = f.enemies; f.state.cityHp = 1;
battle(f); assert.equal(f.state.phase, 'defeat');
const savedFailure = BattleModel.load(f.save()); assert(savedFailure); assert(savedFailure.retry());
assert.equal(savedFailure.state.round, 0); assert.equal(savedFailure.state.coins, 0); assert.equal(savedFailure.guards.length, 3);
assert.equal(savedFailure.state.cityHp, 100); assert(!savedFailure.retry());
const bad = m.save(); bad.state.coins = -100; assert.equal(BattleModel.load(bad), null);
const duplicated = m.save(); duplicated.state.units.push(duplicated.state.units[0]); assert.equal(BattleModel.load(duplicated), null);
const nullUnit = m.save(); nullUnit.state.units.push(null); assert.equal(BattleModel.load(nullUnit), null);
assert.equal(BattleModel.load({}), null); assert.equal(BattleModel.load(null), null);
console.log('首战验证通过：53→23→18经济、在线/回合收入、4回合、集火、失败回滚、存档恢复/校验、防重复奖励。');
