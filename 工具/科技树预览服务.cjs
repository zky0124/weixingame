const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../游戏策划/科技树表格');
const port=Number(process.argv[2]||7466);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('端口无效');
const allowed=new Set(['科技树规划器.html','科技树规划器.js','科技树模型.js','科技树初始数据.js']);
http.createServer((req,res)=>{
 let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'科技树规划器.html';}catch{res.writeHead(400);res.end();return;}
 if(!allowed.has(name)){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':name.endsWith('.html')?'text/html; charset=utf-8':'application/javascript; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 fs.createReadStream(path.join(root,name)).pipe(res);
}).listen(port,'127.0.0.1',()=>console.log('科技树规划器：http://127.0.0.1:'+port));
