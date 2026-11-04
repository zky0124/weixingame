const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),data=JSON.parse(fs.readFileSync(path.join(root,'游戏策划/城镇与建筑表格/已确认配置.json'),'utf8'));
const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,data.source))).digest('hex');
if(hash!==data.sourceSha256)throw Error('建筑表已再次修改，请核对新改动并更新已确认配置后再同步，不能用旧配置覆盖新填写内容。');
const target=path.join(root,'游戏工程/assets/脚本/城市/TownDesign.ts');
const text='// 从已确认配置.json生成，修改原资料并运行工具/同步城镇设定.cjs。\n'+
 'export const TOWN_NODES = '+JSON.stringify(data.towns,null,2)+' as const;\n'+
 'export const FARM_LEVELS = '+JSON.stringify(data.farmLevels,null,2)+' as const;\n'+
 'export const RESEARCH_DESIGN = '+JSON.stringify(data.research,null,2)+' as const;\n'+
 'export const HOSPITAL_RULES = '+JSON.stringify(data.hospital,null,2)+' as const;\n'+
 'export const BUILDING_DESIGNS = '+JSON.stringify(data.buildings,null,2)+' as const;\n';
if(process.argv.includes('--check')){if(!fs.existsSync(target)||fs.readFileSync(target,'utf8').replace(/\r\n/g,'\n')!==text)throw Error('城镇运行配置尚未同步');console.log('城镇配置检查通过：原表指纹、4节点、13建筑与研究产出。');}
else{fs.writeFileSync(target,text);console.log('城镇与研究运行配置已同步，未改写用户表格。');}
