const fs=require('fs'),path=require('path');
const repoHome=path.resolve(__dirname,'..');
const root=path.join(repoHome,'游戏策划','单位资料');
const abs=p=>path.resolve(p).replaceAll('\\','/');
const read=p=>fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'').replace(/\r\n|\r/g,'\n');
const write=(p,s)=>{
 fs.mkdirSync(path.dirname(p),{recursive:true});
 if(p.endsWith('.md'))s=s.replace(/\]\(([^)]+)\)/g,(m,t)=>{
  const c=t.replace(/^<|>$/g,'');
  const full=c.replaceAll('\\','/');
  return full.startsWith(repoHome.replaceAll('\\','/')+'/')?']('+path.relative(path.dirname(p),c).replaceAll('\\','/')+')':m;
 });
 fs.writeFileSync(p,s,'utf8');
};
const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(p,x.name)):[path.join(p,x.name)]);
const link=(label,p)=>`[${label}](${abs(p)})`;
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const section=(s,h)=>(s.split('## '+h+'\n')[1]||'').split('\n## ')[0].trim();
let units=walk(root).filter(p=>p.endsWith('属性设定.md')).map(file=>{
 const raw=read(file),fields=Object.fromEntries([...raw.matchAll(/^\|\s*([^|\n]+?)\s*\|\s*([^|\n]*?)\s*\|/gm)].map(m=>[m[1].trim(),m[2].trim()]));
 const name=raw.match(/^#\s+([^\n·]+)/m)[1].trim(),cat=fields['单位分类'];
 return {id:path.relative(root,file).replaceAll('\\','/'),file:abs(file),name,title:raw.split('\n')[0].replace(/^# /,''),cat,job:fields['职业/定位'],group:cat==='敌人单位'?path.basename(path.dirname(path.dirname(file))):'人类友军',fields,raw,skill:section(raw,'技能与特殊机制').split('\n\n未列出')[0],ai:section(raw,'寻敌与行动').split('\n\n玩家')[0]};
}).sort((a,b)=>['士兵单位','英雄单位','敌人单位'].indexOf(a.cat)-['士兵单位','英雄单位','敌人单位'].indexOf(b.cat)||a.name.localeCompare(b.name,'zh-CN'));
if(units.length!==13)console.log('当前单位数量已变化：'+units.length+'，按实际卡片生成。');
const f=(u,k)=>u.fields[k]??'未填写';
function table(items){return '| 单位详情 | 职业 | 护甲类 | 血量 | 攻击/治疗 | 护甲/魔抗 | 频率次/秒 | 射程/移速 | 获取或掉落 |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n'+items.map(u=>`| ${link(u.name,u.file)} | ${u.job} | ${f(u,'护甲类别').split('（')[0]} | ${f(u,'最大血量')} | ${f(u,'普通攻击力')}/${f(u,'单次治疗量')} | ${f(u,'护甲')}/${f(u,'魔法抗性')} | ${f(u,'攻击/治疗频率')} | ${f(u,'攻击/治疗距离')}/${f(u,'移动速度')} | ${f(u,u.cat==='敌人单位'?'击杀掉落':'招募价格与渠道')} |`).join('\n')+'\n';}
function summaries(items){return items.map(u=>`### ${u.title}\n\n- ${link('打开完整属性与技能',u.file)}\n- 职业与身份：${u.job}；${f(u,'品质')}；${f(u,'种族/标签')}。\n- 解锁/首次出现：${f(u,'解锁/首次出现')}。\n- 普攻/治疗：${f(u,'攻击方式')}，${f(u,'近战/远程')}。\n- 行动：${u.ai}\n- 技能：${u.skill.replaceAll('\n',' ')}\n`).join('\n');}
const nav=`${link('可搜索、直接切换详情的离线图鉴',path.join(root,'单位图鉴.html'))} · ${link('职业规则',path.join(root,'职业设定/职业规则.md'))} · ${link('单位总目录',path.join(root,'单位资料说明.md'))}`;
for(const cat of ['士兵单位','英雄单位','敌人单位']){
 const list=units.filter(u=>u.cat===cat);
 let content=`# ${cat}速查\n\n${nav}\n\n当前${list.length}个单位。数据从当前属性卡生成；攻击/治疗为两个独立数值，护甲/魔抗为两个独立数值。\n\n`;
 if(cat==='敌人单位')content+='## 势力大类\n\n'+['哥布林部族','亡灵大军'].map(group=>link(group+'：'+list.filter(u=>u.group===group).length+'种敌人',path.join(root,'敌人单位',group,'部族概览.md'))).join(' · ')+'\n\n前半程哥布林，击败头领后进入亡灵路线；草原狼保留野兽种族标签。\n\n';
 content+=table(list)+'\n## 单位梗概\n\n'+summaries(list);
 write(path.join(root,cat,'单位概览.md'),content);
}
const enemies=units.filter(u=>u.cat==='敌人单位');
write(path.join(root,'敌人单位/哥布林部族/部族概览.md'),`# 哥布林部族\n\n${nav}\n\n## 部族说明\n\n阶段1的主要敌对势力，由散兵、投石手、木盾部队、巫徒、医师、战车和头领组成，并驱使草原狼。部族归属是势力分类，狼保留野兽标签，战车保留机械标签。头领新版光环只给范围内哥布林种族单位护甲+1，不把狼自动算成哥布林。\n\n职业覆盖战士、弓箭手、魔法师、辅助、盾卫、刺客和攻城；当前没有护卫或武道家敌人，职业定义保留给后续扩展。\n\n## 部族速查\n\n${table(enemies.filter(u=>u.group==='哥布林部族'))}\n## 敌人梗概\n\n${summaries(enemies.filter(u=>u.group==='哥布林部族'))}`);
const undead=enemies.filter(u=>u.group==='亡灵大军');
write(path.join(root,'敌人单位/亡灵大军/部族概览.md'),'# 亡灵大军\n\n'+nav+'\n\n阶段1后半程敌人，击败哥布林头领后开启。召唤师、战将和无头骑士的技能原文见各单位卡；当前营地版本只开放哥布林主线，亡灵特殊机制随定居点里程碑接入。\n\n'+table(undead)+'\n## 敌人梗概\n\n'+summaries(undead));
write(path.join(root,'单位资料说明.md'),`# 单位资料总目录\n\n当前${units.length}个有效单位：${units.filter(u=>u.cat==='士兵单位').length}种士兵、${units.filter(u=>u.cat==='英雄单位').length}名英雄、${enemies.length}种敌人。\n\n## 推荐入口\n\n- ${link('单位图鉴：搜索、职业筛选、点名称看详情',path.join(root,'单位图鉴.html'))}\n- ${link('士兵单位：属性表与梗概',path.join(root,'士兵单位/单位概览.md'))}\n- ${link('英雄单位：属性表与梗概',path.join(root,'英雄单位/单位概览.md'))}\n- ${link('敌人单位：势力分类与梗概',path.join(root,'敌人单位/单位概览.md'))}\n- ${link('哥布林部族：前半程敌人',path.join(root,'敌人单位/哥布林部族/部族概览.md'))}\n- ${link('亡灵大军：击败哥布林头领后的敌人',path.join(root,'敌人单位/亡灵大军/部族概览.md'))}\n- ${link('职业设定：九种职业及通用行为',path.join(root,'职业设定/职业规则.md'))}\n\n## 修改方式\n\n各单位文件夹里的“属性设定.md”为原始资料，可用记事本、编辑器直接修改；属性卡中的当前值优先于旧策划摘要。分类表、梗概和网页从属性卡生成。修改后双击本目录“刷新图鉴.cmd”，再刷新打开的网页，即可更新派生表格与图鉴。刷新脚本不改动单位卡。\n\n网页双击即可离线打开，无需登录或服务器；点击名称进入本页详情，支持返回、搜索和分类筛选。Markdown索引采用仓库相对链接，方便协作者在各自电脑阅读。\n\n士兵与英雄按单位存放；敌人按“敌人单位/势力大类/单位名”存放。敌人分为哥布林部族和亡灵大军两大类。单位名与文件夹一致，民兵、哥布林战车采用用户新名称。草药医护已被用户移除，当前不恢复。\n\n## 属性规则\n\n- 攻击与治疗、职业与种族、重甲标签与数值护甲分别记录。护甲0的护卫仍可有重甲职业标签，不擅自改数值。\n- 攻速为每秒次数，基础间隔为1÷频率的派生展示。草原狼频率1.5对应间隔约0.667秒。\n- 原始属性保留用户编辑，包括哥布林头领魔抗-3；没有用旧表覆盖。\n- 新职业核心规则来自用户；范围、同时选目标排序、分摊结算等补齐细节见职业规则，标为可调整初稿。\n- 属性卡通过工具/同步首战单位.cjs生成28种单位配置；新增单位不等于已开放招募或实现全部技能。当前试玩开放护卫、民兵、弓箭手与哥布林战线，亡灵复杂技能和英雄另行实现。\n\n## 全单位速查\n\n${table(units)}\n## 同步说明\n\n已同步用户改名、基础值与新版英雄技能。民兵的旧对野兽被动不恢复；医师治疗文案按当前3点统一；艾琳额外箭替代旧固定+6；罗恩全友军双抗光环替代旧自盾；头领哥布林护甲光环替代旧攻速光环。\n`);

// 单文件图鉴，全部资料内嵌，不用fetch，file方式打开也可导航。
const data=JSON.stringify(units.map(u=>({...u,file:path.relative(repoHome,u.file).replaceAll('\\','/')}))).replaceAll('<','\\u003c');
const classes=read(path.join(root,'职业设定/职业规则.md'));
let html=String.raw`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>蛮荒开拓 · 单位图鉴</title>
<style>*{box-sizing:border-box}body{margin:0;background:#f5f3eb;color:#253b32;font:15px/1.7 "Microsoft YaHei",sans-serif}header{background:#183e33;color:#fff;padding:26px 5vw}header small{color:#b9ccb9;letter-spacing:3px}h1{font-size:28px;margin:3px 0}main{max-width:1450px;margin:auto;padding:25px 4vw}nav{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px}a{color:#176448}button,a.pill{font:inherit;cursor:pointer;border:1px solid #cad4c8;border-radius:7px;background:white;color:#254a38;padding:7px 16px;text-decoration:none}button.active{background:#28583f;color:white}input,select{font:inherit;border:1px solid #c5cebe;border-radius:7px;padding:10px 13px;background:white}input{flex:1;min-width:210px}.tools{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}.panel{background:#fff;border:1px solid #dce1d3;border-radius:12px;padding:22px;margin:16px 0;overflow:auto}table{width:100%;border-collapse:collapse;font-size:14px;white-space:normal}th{text-align:left;background:#edf1e8;white-space:nowrap}td,th{padding:11px 12px;border-bottom:1px solid #e7eadf}td:first-child{min-width:120px}td a{font-weight:bold;white-space:nowrap}tr:hover td{background:#fafbf6}.muted{color:#68796b;font-size:13px}.badge{display:inline-block;border:1px solid #d9dfce;border-radius:5px;background:#f0f3e9;padding:1px 9px;margin:2px;font-size:12px}h2{font-size:21px;margin:16px 0 10px}h3{font-size:17px}#detail table{max-width:100%;table-layout:auto}#detail p{max-width:1000px}.count{color:#bd9c55;font-weight:bold}.error{background:#fff3e9;padding:16px}a:focus,button:focus,input:focus{outline:3px solid #b69b56;outline-offset:2px}@media(max-width:700px){main{padding:15px}header{padding:20px}th,td{padding:8px}h1{font-size:24px}}</style>
<header><small>阶段一 / 策划工作图鉴</small><h1>蛮荒开拓 · 单位图鉴</h1><div>友军、哥布林部族、亡灵大军与职业规则，一处查阅。名称与数值来自当前单位卡。</div></header>
<main><nav id="nav"><a class="pill" href="#overview">全部单位</a><a class="pill" href="#soldiers">士兵</a><a class="pill" href="#heroes">英雄</a><a class="pill" href="#enemies">全部敌人</a><a class="pill" href="#goblins">哥布林部族</a><a class="pill" href="#undead">亡灵大军</a><a class="pill" href="#classes">职业规则</a></nav><div class="muted">这是文档快照。改完属性设定.md后，运行“刷新图鉴.cmd”再刷新本页；不会覆盖你的原始属性卡。</div><section id="overview"><div class="tools"><input id="search" aria-label="搜索单位" placeholder="搜索名字、职业、种族或技能…"><select id="job" aria-label="职业筛选"><option value="">全部职业</option></select></div><div id="results"></div></section><article id="detail" hidden></article></main>
<script>const UNITS=${data};const CLASS_TEXT=${JSON.stringify(classes).replaceAll('<','\\u003c')};
const $=id=>document.getElementById(id);const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const field=(u,k)=>u.fields[k]??'—';let group='',faction='';
function inline(s){return esc(s).replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>').replace(/\x60([^\x60]+)\x60/g,'<code>$1</code>');}
function markdown(s){const lines=s.split('\n');let out='',table=[],para=[];function p(){if(para.length){out+='<p>'+inline(para.join(' '))+'</p>';para=[];}}function t(){if(!table.length)return;out+='<div class="panel"><table>';let head=true;for(const line of table){const cells=line.trim().split('|').slice(1,-1).map(x=>x.trim());if(cells.every(x=>/^:?-+:?$/.test(x)))continue;out+='<tr>'+cells.map(x=>'<'+(head?'th':'td')+'>'+inline(x)+'</'+(head?'th':'td')+'>').join('')+'</tr>';head=false;}out+='</table></div>';table=[];}for(const line of lines){if(line.trim().startsWith('|')){p();table.push(line);continue;}t();if(!line.trim()){p();continue;}const h=line.match(/^(#{1,3})\s+(.*)$/);if(h){p();const level=Math.min(h[1].length+1,4);out+='<h'+level+'>'+inline(h[2])+'</h'+level+'>';}else if(/^[-*] /.test(line)){p();out+='<p>• '+inline(line.slice(2))+'</p>';}else para.push(line);}p();t();return out;}
function renderList(){const q=$('search').value.toLowerCase(),j=$('job').value;const list=UNITS.filter(u=>(!group||u.cat===group)&&(!faction||u.group===faction)&&(!j||u.job===j)&&(!q||(UNITS.some(x=>x.name.toLowerCase()===q)?u.name.toLowerCase()===q:(u.name+u.job+u.raw).toLowerCase().includes(q))));$('results').innerHTML='<div class="muted">当前显示 <span class="count">'+list.length+'</span> / '+UNITS.length+' 个单位；点击名称查看完整详情。</div><div class="panel"><table><thead><tr><th>单位 / 详情</th><th>分类 / 职业</th><th>血量</th><th>攻击 / 治疗</th><th>护甲 / 魔抗</th><th>频率</th><th>射程 / 移速</th><th>核心特点</th></tr></thead><tbody>'+list.map(u=>'<tr><td><a href="#unit='+encodeURIComponent(u.id)+'">'+esc(u.name)+'</a><div class="muted">'+esc(field(u,'品质'))+'</div></td><td>'+esc(u.cat)+'<br><span class="badge">'+esc(u.job)+'</span></td><td>'+esc(field(u,'最大血量'))+'</td><td>'+esc(field(u,'普通攻击力'))+' / '+esc(field(u,'单次治疗量'))+'</td><td>'+esc(field(u,'护甲'))+' / '+esc(field(u,'魔法抗性'))+'</td><td>'+esc(field(u,'攻击/治疗频率'))+'次/秒</td><td>'+esc(field(u,'攻击/治疗距离'))+' / '+esc(field(u,'移动速度'))+'</td><td>'+esc(u.skill).slice(0,115)+'…</td></tr>').join('')+'</tbody></table></div>';}
function route(){const hash=location.hash.slice(1);$('overview').hidden=false;$('detail').hidden=true;if(hash.startsWith('unit=')){let id;try{id=decodeURIComponent(hash.slice(5));}catch{}const u=UNITS.find(x=>x.id===id);$('overview').hidden=true;$('detail').hidden=false;$('detail').innerHTML=u?'<a class="pill" href="#'+(u.cat==='敌人单位'?'enemies':u.cat==='英雄单位'?'heroes':'soldiers')+'">← 返回分类速查</a><div class="panel"><div class="muted">'+esc(u.cat)+' / '+esc(u.group)+' / '+esc(u.job)+'</div>'+markdown(u.raw)+'<hr><p class="muted">编辑源文件：'+esc(u.file)+'</p></div>':'<div class="error">单位不存在，请回总目录刷新查看。</div>';window.scrollTo(0,0);return;}if(hash==='classes'){$('overview').hidden=true;$('detail').hidden=false;$('detail').innerHTML='<div class="panel">'+markdown(CLASS_TEXT)+'</div>';window.scrollTo(0,0);return;}faction=hash==='goblins'?'哥布林部族':hash==='undead'?'亡灵大军':'';group=hash==='soldiers'?'士兵单位':hash==='heroes'?'英雄单位':['enemies','goblins','undead'].includes(hash)?'敌人单位':'';renderList();}
for(const j of [...new Set(UNITS.map(u=>u.job))]){const o=document.createElement('option');o.value=j;o.textContent=j;$('job').appendChild(o);}$('search').addEventListener('input',renderList);$('job').addEventListener('change',renderList);window.addEventListener('hashchange',route);route();
</script></html>`;
// 对生成脚本做语法检查，避免点击导航后才暴露语法错误。
new Function(html.match(/<script>([\s\S]*)<\/script>/)[1]);
write(path.join(root,'单位图鉴.html'),html);
write(path.join(repoHome,'.本地缓存','单位图鉴最新索引.json'),JSON.stringify(units.map(({raw,...u})=>u),null,2));
let broken=[];for(const p of walk(root).filter(x=>x.endsWith('.md'))){for(const m of read(p).matchAll(/\]\(([^)]+\.(?:md|html))\)/g)){const t=m[1];if(/^https?:/.test(t))continue;const resolved=/^[A-Za-z]:/.test(t)?t:path.resolve(path.dirname(p),t);if(!fs.existsSync(resolved))broken.push({source:p,target:t});}}
if(broken.length)throw Error('失效链接：'+JSON.stringify(broken));
console.log(JSON.stringify({units:units.length,brokenLinks:broken.length,html:abs(path.join(root,'单位图鉴.html')),classes:[...new Set(units.map(u=>u.job))]}));
