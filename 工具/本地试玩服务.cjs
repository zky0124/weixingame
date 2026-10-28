const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../游戏工程/build/web-mobile');
const preview = path.join(__dirname, '手机尺寸预览.html');
const port = Number(process.argv[2] || 7456);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('本地服务端口应为1024—65535之间的整数');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.wasm': 'application/wasm', '.png': 'image/png', '.svg': 'image/svg+xml' };
if (!fs.existsSync(path.join(root, 'index.html'))) throw new Error('请先完成Cocos web-mobile构建');
http.createServer((req, res) => {
  let requestPath;
  try { requestPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400); res.end(); return; }
  const target = requestPath === '/preview' ? preview : path.resolve(root, '.' + (requestPath === '/' ? '/index.html' : requestPath));
  if (target !== preview && !target.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.stat(target, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(target).pipe(res);
  });
}).listen(port, '127.0.0.1', () => console.log(`本地试玩：http://127.0.0.1:${port}/preview （仅本机访问，Ctrl+C停止）`));
