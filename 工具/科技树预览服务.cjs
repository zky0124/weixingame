const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const M=require('../游戏策划/科技树表格/科技树模型.js');
function createServer(options={}){
 const root=options.root||path.resolve(__dirname,'../游戏策划/科技树表格');
 const backup=options.backup||path.resolve(__dirname,'../.本地缓存/科技树存档历史');
 const file=path.join(root,'科技树系统.json');
 const allowed=new Set(['科技树系统.html','科技树系统.js','科技树模型.js','科技树初始数据.js']);
 const aliases={'科技树规划器.html':'科技树系统.html','科技树规划器.js':'科技树系统.js'};
 const revision=()=>fs.existsSync(file)?crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'):'none';
 const json=(res,code,value)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
 const server=http.createServer((req,res)=>{
  const port=server.address().port;
  if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host)){json(res,403,{error:'仅接受本机服务访问'});return;}
  let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'科技树系统.html';}catch{json(res,400,{error:'路径无效'});return;}
  if(name==='project-draft'){
   if(req.method==='GET'){
    try{json(res,200,{exists:fs.existsSync(file),revision:revision(),document:fs.existsSync(file)?M.validate(JSON.parse(fs.readFileSync(file,'utf8'))):null});}catch{json(res,500,{error:'项目存档无法读取，原文件未改动'});}return;
   }
   if(req.method!=='POST'){json(res,405,{error:'不支持的操作'});return;}
   if(req.headers.origin!==`http://${req.headers.host}`||!(req.headers['content-type']||'').startsWith('application/json')){json(res,403,{error:'保存必须来自科技树系统本机页面'});return;}
   const chunks=[];let size=0,rejected=false;req.on('data',chunk=>{size+=chunk.length;if(size>2000000){rejected=true;res.writeHead(413);res.end();req.destroy();return;}chunks.push(chunk);});
   req.on('end',()=>{
    if(rejected)return;
    try{
     const doc=M.validate(JSON.parse(Buffer.concat(chunks).toString('utf8')).document);
     if(req.headers['if-match']!==revision()){json(res,409,{error:'项目文件已在别处修改，请先载入项目版本或另存JSON备份。'});return;}
     if(fs.existsSync(file)){fs.mkdirSync(backup,{recursive:true});fs.copyFileSync(file,path.join(backup,'科技树系统-'+Date.now()+'-'+crypto.randomBytes(3).toString('hex')+'.json'));}
     fs.mkdirSync(root,{recursive:true});const temp=file+'.tmp';
     fs.writeFileSync(temp,JSON.stringify({...doc,projectSavedAt:new Date().toISOString()},null,2)+'\n');fs.renameSync(temp,file);
     json(res,200,{revision:revision(),file:'科技树系统.json'});
    }catch(error){json(res,400,{error:error.message});}
   });return;
  }
  if(req.method!=='GET'){json(res,405,{error:'不支持的操作'});return;}
  name=aliases[name]||name;
  if(!allowed.has(name)||!fs.existsSync(path.join(root,name))){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':name.endsWith('.html')?'text/html; charset=utf-8':'application/javascript; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  fs.createReadStream(path.join(root,name)).pipe(res);
 });
 return server;
}
if(require.main===module){const port=Number(process.argv[2]||7466);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('端口无效');createServer().listen(port,'127.0.0.1',()=>console.log('科技树系统：http://127.0.0.1:'+port));}
module.exports={createServer};
