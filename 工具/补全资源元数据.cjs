const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '../游戏工程/assets');
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.endsWith('.meta')) continue;
    const full = path.join(dir, entry.name);
    if (!fs.existsSync(full + '.meta')) {
      const directory = entry.isDirectory();
      const importer = directory ? 'directory' : entry.name.endsWith('.ts') ? 'typescript' : entry.name.endsWith('.scene') ? 'scene' : null;
      if (!importer) throw new Error('请通过编辑器导入此资源：' + full);
      fs.writeFileSync(full + '.meta', JSON.stringify({ ver: directory ? '1.2.0' : importer === 'typescript' ? '4.0.24' : '1.1.50', importer, imported: true, uuid: randomUUID(), files: importer === 'scene' ? ['.json'] : [], subMetas: {}, userData: {} }, null, 2) + '\n');
    }
    if (entry.isDirectory()) walk(full);
  }
}
walk(root);
console.log('资源元数据已补全，已有UUID保留。');
