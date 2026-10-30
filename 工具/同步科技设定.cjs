const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),M=require('../游戏策划/科技树表格/科技树模型.js');
const file=path.join(root,'游戏策划/科技树表格/科技树系统.json');
if(!fs.existsSync(file))throw Error('尚未收到科技树系统.json，请在原页面点击保存到项目，不能用示例树替代。');
const doc=M.validate(JSON.parse(fs.readFileSync(file,'utf8')));
const reviewed=JSON.parse(fs.readFileSync(path.join(root,'游戏策划/科技树表格/科技执行映射.json'),'utf8'));
const definitions=doc.nodes.filter(n=>n.parent!==null).map(n=>{
 if(!reviewed[n.id]||n.name!==reviewed[n.id].name||n.effect!==reviewed[n.id].sourceEffect)throw Error('科技需要重新核对执行效果：'+n.id+' '+n.name);
 let minTown=0,minFarm=0;const buildings=[];
 for(const condition of n.conditions.split(/\n|；|;/).map(x=>x.trim()).filter(Boolean)){
  if(condition==='定居点')minTown=3;else if(condition==='有一块三级农田')minFarm=3;else if(condition==='医院')buildings.push('B006');else throw Error('尚未核对的科技条件：'+condition);
 }
 if(n.seconds!==null&&n.seconds!==0)throw Error('尚未实现研究计时，不能忽略非零耗时：'+n.id);
 const prerequisites=Array.from(new Set([n.parent,...n.requires].filter(id=>id&&id!=='ROOT'))).map(id=>({id,level:doc.nodes.find(x=>x.id===id).level}));
 return {id:n.id,name:n.name,branch:n.branch,maxLevel:n.level,pointCost:n.points,coinCost:n.coins??0,prerequisites,mode:n.mode,minTown,minFarm,buildings,effect:{kind:reviewed[n.id].kind,target:reviewed[n.id].target,value:reviewed[n.id].value},description:n.effect};
});
const target=path.join(root,'游戏工程/assets/脚本/城市/TechnologyData.ts');
const text='// 从科技树系统.json核对生成；文字效果通过显式映射执行，不动态执行用户文本。\nexport const TECHNOLOGIES = '+JSON.stringify(definitions,null,2)+' as const;\n';
if(process.argv.includes('--check')){if(!fs.existsSync(target)||fs.readFileSync(target,'utf8').replace(/\r\n/g,'\n')!==text)throw Error('科技运行数据未同步，请核对科技树后运行工具/同步科技设定.cjs');console.log('科技配置检查通过：'+definitions.length+'项、跨路线前置、等级/费用及生效目标。');}
else{fs.writeFileSync(target,text);fs.writeFileSync(path.join(root,'游戏策划/科技树表格/科技树初始数据.js'),'window.TECH_TREE_SEED = '+JSON.stringify(doc,null,2)+';\n');console.log('已同步'+definitions.length+'项科技，保留原草稿文件及节点位置。');}
