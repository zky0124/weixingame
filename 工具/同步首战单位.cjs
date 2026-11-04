const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),unitRoot=path.join(root,'游戏策划/单位资料');
const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.join(p,e.name)]);
const aliases={'护卫':'guard','哥布林散兵':'goblin','民兵':'militia','弓箭手':'archer','草原狼':'wolf','木盾哥布林':'shieldGoblin','投石哥布林':'stoneGoblin','哥布林巫徒':'mageGoblin','哥布林医师':'healerGoblin','哥布林战车':'siegeGoblin','哥布林头领':'goblinBoss','骷髅':'skeleton','骷髅战士':'skeletonWarrior','骷髅弓箭手':'skeletonArcher','骷髅魔法师':'skeletonMage','亡灵召唤师':'necromancer','骷髅战将':'skeletonGeneral','游魂':'ghost','僵尸':'zombie','无头骑士':'headlessKnight','医疗队':'medic','熟练弓箭手':'veteranArcher','护卫队长':'guardCaptain','熟练民兵':'veteranMilitia','魔法师':'mage','艾琳':'ailin','罗恩':'ron','奶蛙':'frog'};
const result={};
for(const source of walk(unitRoot).filter(p=>p.endsWith('属性设定.md'))){
 const raw=fs.readFileSync(source,'utf8'),rows=Object.fromEntries([...raw.matchAll(/^\|\s*([^|\n]+?)\s*\|\s*([^|\n]*?)\s*\|/gm)].map(m=>[m[1].trim(),m[2].trim()]));
 const name=raw.match(/^# (.+)/m)[1].split('·')[0].trim(),id=aliases[name];if(!id)throw Error('新单位需要稳定运行编号：'+name);
 const number=key=>{const n=Number(rows[key]);if(!Number.isFinite(n))throw Error(name+'属性无效：'+key);return n;};
 const side=rows['单位分类']==='敌人单位'?'enemy':'ally';
 result[id]={name,hp:number('最大血量'),attack:number('普通攻击力'),heal:number('单次治疗量'),armor:number('护甲'),resistance:number('魔法抗性'),rate:number('攻击/治疗频率'),range:number('攻击/治疗距离'),speed:number('移动速度'),job:rows['职业/定位'],heavy:rows['护甲类别'].startsWith('重甲'),side,type:rows['攻击方式'].includes('魔法')?'magic':'physical',faction:side==='ally'?'player':source.includes('亡灵大军')?'undead':'goblin',race:rows['种族/标签'],cost:side==='ally'?(rows['招募价格与渠道'].match(/^(\d+)铜币$/)?Number(rows['招募价格与渠道'].match(/^(\d+)铜币$/)[1]):null):0,drop:side==='enemy'?Number(rows['击杀掉落'].match(/^(\d+)铜币/)?.[1]??0):0,source:path.relative(root,source).replaceAll('\\','/')};
}
const output='// 从当前28份单位卡生成，不覆盖用户单位卡。\nexport interface UnitDefinition { name:string; hp:number; attack:number; heal:number; armor:number; resistance:number; rate:number; range:number; speed:number; job:string; heavy:boolean; side:string; type:string; faction:string; race:string; cost:number|null; drop:number; source:string }\nexport const UNIT_DATA = '+JSON.stringify(result,null,2)+' as const;\nexport type UnitKind = keyof typeof UNIT_DATA;\nexport function unitData(kind:UnitKind):UnitDefinition { return UNIT_DATA[kind]; }\n';
const target=path.join(root,'游戏工程/assets/脚本/数据/UnitData.ts');
if(process.argv.includes('--check')){if(fs.readFileSync(target,'utf8').replace(/\r\n/g,'\n')!==output)throw Error('单位运行数据未同步，请运行工具/同步首战单位.cjs');}
else fs.writeFileSync(target,output);
console.log('单位属性同步检查通过：'+Object.keys(result).length+'个单位，含两支怪物势力。');
