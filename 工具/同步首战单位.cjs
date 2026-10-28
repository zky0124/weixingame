const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const entries = {
  guard: '游戏策划/单位资料/士兵单位/护卫/属性设定.md',
  goblin: '游戏策划/单位资料/敌人单位/哥布林部族/哥布林散兵/属性设定.md',
};
const result = {};
for (const [id, source] of Object.entries(entries)) {
  const raw = fs.readFileSync(path.join(root, source), 'utf8');
  const rows = Object.fromEntries(raw.split(/\r?\n/).filter(l => l.startsWith('|')).map(l => l.split('|').slice(1, -1).map(s => s.trim())).map(r => [r[0], r[1]]));
  const number = key => {
    const n = Number(rows[key]);
    if (!Number.isFinite(n)) throw new Error(`${source}: 无效属性 ${key}`);
    return n;
  };
  result[id] = { name: raw.match(/^# (.+)/m)[1], hp: number('最大血量'), attack: number('普通攻击力'), armor: number('护甲'), resistance: number('魔法抗性'), rate: number('攻击/治疗频率'), range: number('攻击/治疗距离'), speed: number('移动速度'), source };
}
const output = '// 从单位属性卡生成，请修改单位卡后运行 node 工具/同步首战单位.cjs。\nexport const UNIT_DATA = ' + JSON.stringify(result, null, 2) + ' as const;\n';
const target = path.join(root, '游戏工程/assets/脚本/数据/UnitData.ts');
if (process.argv.includes('--check')) {
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== output) throw new Error('首战单位数据与属性卡不同步');
} else {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, output);
}
console.log('首战单位属性同步检查通过：护卫、哥布林散兵');
