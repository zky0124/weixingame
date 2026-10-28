const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.join(p,e.name)]);
let changed=0;
for(const file of walk(path.join(root,'游戏策划')).filter(p=>p.endsWith('.md'))){
 const old=fs.readFileSync(file,'utf8');
 const next=old.replace(/\]\(([^)]+)\)/g,(m,target)=>{
  let t=target.replace(/^<|>$/g,'').replaceAll('\\','/');
  if(t.startsWith('G:/新游戏项目/'))t=path.join(root,t.slice('G:/新游戏项目/'.length));
  if(!path.isAbsolute(t)||!path.resolve(t).startsWith(root+path.sep))return m;
  const rel=path.relative(path.dirname(file),t).replaceAll('\\','/');return `](${rel.includes(' ')?'<'+rel+'>':rel})`;
 });
 if(next!==old){fs.writeFileSync(file,next,'utf8');changed++;}
}
console.log(`已规范${changed}份文档的本机绝对链接。`);
