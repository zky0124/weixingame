const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
function inspectPng(full) {
  const bytes = fs.readFileSync(full);
  assert(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), '不是PNG图片');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  assert(width <= 4096 && height <= 4096 && width > 0 && height > 0);
  assert.equal(bytes[24], 8, '建筑素材应为8位PNG');
  assert.equal(bytes[25], 6, '建筑素材应保留RGBA透明通道');
  assert.equal(bytes[28], 0, '检查器只接受非交错PNG');
  const chunks = [];
  for (let p = 8; p < bytes.length;) {
    const len = bytes.readUInt32BE(p), type = bytes.toString('ascii', p + 4, p + 8);
    if (type === 'IDAT') chunks.push(bytes.subarray(p + 8, p + 8 + len));
    p += len + 12;
  }
  const stride = width * 4;
  const raw = zlib.inflateSync(Buffer.concat(chunks), { maxOutputLength: (stride + 1) * height });
  assert.equal(raw.length, (stride + 1) * height);
  let prev = Buffer.alloc(stride), transparent = 0, covered = 0, minX = width, minY = height, maxX = 0, maxY = 0;
  for (let y = 0; y < height; y++) {
    const offset = y * (stride + 1), filter = raw[offset], line = Buffer.alloc(stride);
    assert(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? line[x - 4] : 0, b = prev[x], c = x >= 4 ? prev[x - 4] : 0;
      let predictor = 0;
      if (filter === 1) predictor = a;
      if (filter === 2) predictor = b;
      if (filter === 3) predictor = Math.floor((a + b) / 2);
      if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        predictor = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[x] = (raw[offset + 1 + x] + predictor) & 255;
    }
    for (let x = 0; x < width; x++) {
      const alpha = line[x * 4 + 3];
      if (alpha === 0) transparent++;
      if (alpha > 24) { covered++; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    }
    prev = line;
  }
  assert(transparent > width * height * 0.1, '需要真实透明背景');
  assert(covered > width * height * 0.1, '主体过小或不可见');
  return { width, height, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), transparentRatio: Number((transparent / (width * height)).toFixed(4)), visibleBounds: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } };
}
const result = {};
for (const name of ['临时庇护所', '简易房屋', '农田']) {
  const file = `游戏工程/assets/resources/建筑/${name}.png`;
  result[name] = { file, ...inspectPng(path.join(root, file)) };
  if (!process.argv.includes('--write')) {
    const meta = JSON.parse(fs.readFileSync(path.join(root, file + '.meta'), 'utf8'));
    const frame = meta.subMetas?.f9941;
    assert.equal(frame?.name, 'spriteFrame', '图片需要由引擎导入为SpriteFrame');
    assert.equal(frame.uuid, meta.uuid + '@f9941', '图片子资源UUID应稳定');
    const box = result[name].visibleBounds, trim = frame.userData;
    assert.equal(trim.trimThreshold, 24, '使用统一的透明裁边阈值');
    assert.deepEqual([trim.trimX, trim.trimY, trim.width, trim.height], [box.x, box.y, box.width, box.height], '裁边应覆盖实际可见主体');
  }
}
const manifestPath = path.join(root, '美术资源/建筑/第一批/资源清单.json');
if (process.argv.includes('--write')) fs.writeFileSync(manifestPath, JSON.stringify(result, null, 2) + '\n');
else assert.deepEqual(result, JSON.parse(fs.readFileSync(manifestPath, 'utf8')), '图片与资源清单不一致，请确认更新后重写清单');
console.log(process.argv.includes('--write') ? JSON.stringify(result, null, 2) : '建筑图片检查通过：3张RGBA透明PNG、来源哈希、可见范围和SpriteFrame裁边一致。');
