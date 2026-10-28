const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..'),unitRoot=path.join(root,'游戏策划','单位资料');
const skip=new Set(['.git','.本地缓存','资料备份','node_modules','library','temp','build']);
const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()&&!skip.has(e.name)?walk(path.join(p,e.name)):e.isFile()?[path.join(p,e.name)]:[]);
const read=p=>fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'').replace(/\r\n|\r/g,'\n');
const fields=s=>Object.fromEntries([...s.matchAll(/^\|\s*([^|\n]+?)\s*\|\s*([^|\n]*?)\s*\|/gm)].map(m=>[m[1].trim(),m[2].trim()]));
let links=0;
for(const file of walk(root).filter(p=>p.endsWith('.md')))for(const m of read(file).matchAll(/\]\(([^)]+)\)/g)){
 let t=m[1].replace(/^<|>$/g,'');if(/^(https?:|mailto:|codex:|#)/.test(t))continue;t=t.split('#')[0];if(!t)continue;
 assert(!/^[A-Za-z]:[\\/]/.test(t),`链接依赖盘符：${file} → ${t}`);
 assert(fs.existsSync(path.resolve(path.dirname(file),decodeURIComponent(t))),`失效链接：${file} → ${t}`);links++;
}
const cards=walk(unitRoot).filter(p=>p.endsWith('属性设定.md'));assert(cards.length>0);
const jobs=new Set(['弓箭手','战士','魔法师','辅助','盾卫','刺客','护卫','攻城','武道家']),names=new Set();
for(const file of cards){const data=fields(read(file)),name=path.basename(path.dirname(file));assert(jobs.has(data['职业/定位']),`${name}职业无效`);assert(!names.has(name),`${name}重名`);names.add(name);for(const k of ['最大血量','普通攻击力','单次治疗量','护甲','魔法抗性','攻击/治疗频率','攻击/治疗距离','移动速度'])assert(data[k]!==undefined&&Number.isFinite(Number(data[k])),`${name}的${k}无效`);assert(Number(data['最大血量'])>0&&Number(data['攻击/治疗频率'])>0);}
const html=read(path.join(unitRoot,'单位图鉴.html')),script=html.match(/<script>([\s\S]*)<\/script>/);assert(script);
const elements={};const el=id=>elements[id]??={value:'',innerHTML:'',hidden:false,appendChild(){},addEventListener(){}};
const ctx={document:{getElementById:el,createElement:()=>({})},location:{hash:'#overview'},window:{scrollTo(){},addEventListener(){}},console};vm.createContext(ctx);vm.runInContext(script[1],ctx,{timeout:3000});
const units=vm.runInContext('UNITS',ctx);assert.equal(units.length,cards.length,'图鉴数量未同步');
for(const u of units){const p=path.resolve(root,u.file);assert(fs.existsSync(p),`缺少${u.file}`);const current=fields(read(p));for(const k of Object.keys(current))assert.equal(u.fields[k],current[k],`${u.name}的${k}未同步`);assert.equal(u.raw.trim(),read(p).trim(),`${u.name}文本未同步，运行图鉴刷新`);ctx.location.hash='#unit='+encodeURIComponent(u.id);vm.runInContext('route()',ctx,{timeout:3000});assert(el('detail').innerHTML.includes(u.name)&&el('detail').innerHTML.includes('最大血量'));}
ctx.location.hash='#overview';vm.runInContext('route()',ctx);el('search').value=units[0].name;vm.runInContext('renderList()',ctx);assert.equal((el('results').innerHTML.match(/href="#unit=/g)||[]).length,1);
el('search').value='';el('job').value=units[0].job;vm.runInContext('renderList()',ctx);assert.equal((el('results').innerHTML.match(/href="#unit=/g)||[]).length,units.filter(u=>u.job===units[0].job).length);
console.log(JSON.stringify({links,unitCards:cards.length,details:units.length,search:'通过',filter:'通过',dataSync:'通过',note:'不代替真实浏览器视觉验收与Cocos游戏测试'},null,2));
