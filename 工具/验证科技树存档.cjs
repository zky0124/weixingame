const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createServer}=require('./科技树预览服务.cjs'),M=require('../游戏策划/科技树表格/科技树模型.js');
async function run(){
 const workspace=path.resolve(__dirname,'../.本地缓存/科技树存档测试');fs.mkdirSync(workspace,{recursive:true});const root=fs.mkdtempSync(path.join(workspace,'case-'));
 const server=createServer({root,backup:path.join(root,'备份')});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port,url=origin+'/project-draft';
 try{
  const node={id:'ROOT',parent:null,name:'研究塔中文',level:1,x:0,y:0,color:'#112233',requires:[]};const doc=M.validate({version:1,nodes:[node]});
  let read=await fetch(url).then(r=>r.json());assert(!read.exists);
  const post=(value,revision,source=origin)=>fetch(url,{method:'POST',headers:{Origin:source,'Content-Type':'application/json','If-Match':revision},body:JSON.stringify({document:value})});
  assert.equal((await post(doc,'none','https://example.invalid')).status,403);
  let response=await post(doc,'none');assert.equal(response.status,200);let saved=await response.json();
  const target=path.join(root,'科技树系统.json');assert.equal(JSON.parse(fs.readFileSync(target,'utf8')).nodes[0].name,'研究塔中文');
  const edited=M.update(doc,'ROOT',{name:'新的中文名称'});assert.equal((await post(edited,'none')).status,409);assert.equal(JSON.parse(fs.readFileSync(target,'utf8')).nodes[0].name,'研究塔中文');
  response=await post(edited,saved.revision);assert.equal(response.status,200);saved=await response.json();assert.equal(fs.readdirSync(path.join(root,'备份')).length,1);
  const invalid=M.clone(edited);invalid.nodes.push({...node,id:'ROOT'});assert.equal((await post(invalid,saved.revision)).status,400);
  read=await fetch(url).then(r=>r.json());assert.equal(read.document.nodes[0].name,'新的中文名称');assert.equal(read.revision,saved.revision);
  assert.equal((await fetch(origin+'/../package.json')).status,404);
  console.log('科技树落盘验证通过：固定路径、中文、自动备份、版本冲突保护、坏数据不覆盖、跨站写入与路径越界拦截。');
 }finally{await new Promise(resolve=>server.close(resolve));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
