(function(){
  'use strict';
  const M=window.TechTreeModel,$=id=>document.getElementById(id),form=$('editor'),map=$('map'),world=$('world');
  const KEY='frontier-tech-planner-v1',history=[],pointers=new Map();
  let doc=M.validate(window.TECH_TREE_SEED),selected=doc.nodes.find(n=>n.parent===null).id,dirty=false,zoom=1,pan={x:0,y:0},gesture=null,writing=true;
  let linking=false,linkSource=null,projectReady=false,projectExists=false,projectConflict=false,projectRevision='none',lastProjectDoc='',saveQueue=Promise.resolve();
  const fields=['name','branch','color','level','points','coins','seconds','effect','conditions','units','buildings','existing','status','notes','mode'];
  function message(text,error=false){$('feedback').textContent=text;$('feedback').classList.toggle('error',error);}
  try{const raw=localStorage.getItem(KEY);if(raw)doc=M.validate(JSON.parse(raw));}catch{writing=false;message('本机旧草稿无法读取，未覆盖原内容。可导入导出的JSON恢复。',true);}
  const root=()=>doc.nodes.find(n=>n.parent===null);
  selected=root().id;
  function persist(){
    if(!writing){$('storageStatus').textContent='旧草稿保留中。完成编辑后请用“保存为JSON”另存。';return;}
    try{localStorage.setItem(KEY,JSON.stringify(doc));$('storageStatus').textContent='草稿已存当前浏览器；可点“保存到项目”直接落盘。';if(projectReady&&projectExists&&!projectConflict)saveProjectDocument(M.clone(doc));}
    catch{$('storageStatus').textContent='本机存储不可用，请保存JSON，避免关闭后丢失。';}
  }
  function push(before){history.push(before??JSON.stringify(doc));if(history.length>40)history.shift();$('undo').disabled=!history.length;}
  function commit(next,before){push(before);doc=next;persist();render();}
  function applyForm(){
    if(!dirty)return true;
    try{
      const node=doc.nodes.find(n=>n.id===selected),patch={};
      for(const field of fields)patch[field]=['level','points','coins','seconds'].includes(field)?(form.elements[field].value===''?null:Number(form.elements[field].value)):form.elements[field].value;
      patch.name=patch.name.trim();patch.parent=node.parent===null?null:form.elements.parent.value;
      patch.requires=form.elements.requires.value.split(/[,，\s]+/).filter(Boolean);
      if(node.parent===null)patch.requires=[];
      const next=M.update(doc,selected,patch);dirty=false;commit(next);message('科技点已保存。');return true;
    }catch(error){message(error.message,true);return false;}
  }
  function select(id){
    if(linking){
      if(!applyForm())return;
      if(!linkSource){linkSource=id;message('已选前置科技。现在点需要它的目标科技。');return;}
      try{const next=M.connect(doc,linkSource,id);selected=id;commit(next);linkSource=null;linking=false;$('connect').classList.remove('gold');message('连线已保存，默认需要同时满足全部前置。');}catch(e){message(e.message,true);linkSource=null;}
      return;
    }
    if(id===selected)return;if(!applyForm())return;selected=id;dirty=false;render();if(innerWidth<700)$('selectedTitle').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function renderForm(){
    const n=doc.nodes.find(n=>n.id===selected)??root();selected=n.id;
    $('selectedTitle').textContent=n.name;$('selectionMeta').textContent=n.parent===null?'中心节点 · 从这里向外创建分支':n.id+' · '+(n.status||'待填写');
    for(const field of fields)form.elements[field].value=n[field]??'';
    form.elements.requires.value=n.requires.join(',');
    const parent=form.elements.parent;parent.replaceChildren();
    for(const candidate of doc.nodes.filter(x=>x.id!==n.id)){
      const option=document.createElement('option');option.value=candidate.id;option.textContent=candidate.name+' · '+candidate.id;parent.append(option);
    }
    if(n.parent)parent.value=n.parent;
    $('parentField').hidden=n.parent===null;$('remove').disabled=n.parent===null;
    $('addBranch').disabled=$('addChild').disabled=doc.nodes.length>=240;
    form.elements.requires.disabled=n.parent===null;
    $('addChild').textContent=n.parent===null?'＋ 新建分支':'＋ 下一级';
    const list=$('dependencyList');list.replaceChildren();
    for(const id of n.requires){
      const source=doc.nodes.find(x=>x.id===id),b=document.createElement('button');b.type='button';b.textContent='解除：'+source.name;b.style.margin='3px';
      b.onclick=()=>{if(!applyForm())return;try{commit(M.disconnect(doc,id,selected));message('已解除这条跨路线连线。');}catch(e){message(e.message,true);}};list.append(b);
    }
    if(!n.requires.length)list.textContent='跨路线前置：暂无。点顶部“连线”，先点前置科技，再点目标科技。';
  }
  function edge(from,to,color,dashed){
    const p=document.createElementNS('http://www.w3.org/2000/svg','path');
    const dx=to.x-from.x,dy=to.y-from.y;
    p.setAttribute('d',`M${from.x},${from.y} C${from.x+dx*.45-dy*.1},${from.y+dy*.45+dx*.1} ${from.x+dx*.65+dy*.1},${from.y+dy*.65-dx*.1} ${to.x},${to.y}`);
    p.setAttribute('fill','none');p.setAttribute('stroke',color);p.setAttribute('stroke-width',dashed?'1.5':'3');p.setAttribute('opacity',dashed?'.4':'.65');if(dashed)p.setAttribute('stroke-dasharray','6 7');$('edges').append(p);
  }
  function renderGraph(){
    $('edges').replaceChildren();const nodes=$('nodes');nodes.replaceChildren();
    const byId=new Map(doc.nodes.map(n=>[n.id,n]));
    for(const n of doc.nodes){if(n.parent)edge(byId.get(n.parent),n,n.color,false);for(const id of n.requires)if(id!==n.parent)edge(byId.get(id),n,n.color,true);}
    for(const n of doc.nodes){
      const b=document.createElement('button');b.type='button';b.className='tech'+(n.parent===null?' root':'')+(n.id===selected?' selected':'');b.dataset.id=n.id;b.style.left=n.x+'px';b.style.top=n.y+'px';b.style.setProperty('--branch',n.color);b.setAttribute('aria-label',n.name+'，'+(n.points===null?'研究点待填写':n.points+'研究点'));b.setAttribute('aria-pressed',String(n.id===selected));
      if(n.parent===null){
        // 原创矢量研究塔，仅用作规划器中心标记。
        const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 64 64');
        const paths=[['M15 57h34v5H15z','#d7b97e'],['M21 25h22v32H21z','#c6b389'],['M16 26 32 3l16 23z','#6ba8bd'],['M28 9h8v10h-8z','#e2c27d'],['M28 43h8v14h-8z','#3a4a56'],['M28 31h8v7h-8z','#f1d78d']];
        for(const [d,fill]of paths){const p=document.createElementNS(icon.namespaceURI,'path');p.setAttribute('d',d);p.setAttribute('fill',fill);icon.append(p);}b.append(icon);
      }else{const code=document.createElement('span');code.className='code';code.textContent=n.id;b.append(code);}
      const title=document.createElement('strong');title.textContent=n.name;b.append(title);const detail=document.createElement('small');detail.textContent=n.parent===null?'科技分支起点':`Lv.${n.level} · ${n.points===null?'研究点待填':n.points+' 研究点'}`;b.append(detail);
      b.addEventListener('click',e=>{if(e.detail===0)select(n.id);});nodes.append(b);
    }
    $('mapTitle').textContent=(doc.title||'研究塔科技规划')+' · '+(doc.nodes.length-1)+'项科技';
  }
  function view(){const r=map.getBoundingClientRect();world.style.transform=`translate(${r.width/2+pan.x}px,${r.height/2+pan.y}px) scale(${zoom})`;$('zoom').textContent=Math.round(zoom*100)+'%';}
  function fit(){const r=map.getBoundingClientRect(),xs=doc.nodes.map(n=>n.x),ys=doc.nodes.map(n=>n.y);const midX=(Math.min(...xs)+Math.max(...xs))/2,midY=(Math.min(...ys)+Math.max(...ys))/2;zoom=Math.max(.25,Math.min(1,(r.width-130)/(Math.max(...xs)-Math.min(...xs)+180),(r.height-170)/(Math.max(...ys)-Math.min(...ys)+180)));pan={x:-midX*zoom,y:-midY*zoom};view();}
  function render(){renderGraph();renderForm();view();$('undo').disabled=!history.length;}
  function zoomAt(x,y,factor){const r=map.getBoundingClientRect(),mx=x-r.left-r.width/2,my=y-r.top-r.height/2;const next=Math.max(.25,Math.min(2.3,zoom*factor)),ratio=next/zoom;pan.x=mx-(mx-pan.x)*ratio;pan.y=my-(my-pan.y)*ratio;zoom=next;view();}
  form.addEventListener('input',()=>{dirty=true;message('此科技点有未保存修改。');});
  form.addEventListener('change',()=>{dirty=true;});
  form.addEventListener('submit',event=>{event.preventDefault();applyForm();});
  $('addBranch').onclick=()=>{if(!applyForm())return;const result=M.add(doc,root().id);commit(result.doc);selected=result.id;render();fit();message('已新增分支，可拖动科技点并填写名称。');};
  $('addChild').onclick=()=>{if(!applyForm())return;const result=M.add(doc,selected);commit(result.doc);selected=result.id;render();fit();message('已新增下一级科技。');};
  $('connect').onclick=()=>{if(!applyForm())return;linking=!linking;linkSource=null;$('connect').classList.toggle('gold',linking);message(linking?'连线模式：先点前置科技，再点需要它的目标科技。':'已退出连线模式。');};
  window.addEventListener('keydown',e=>{if(e.key==='Escape'){linking=false;linkSource=null;$('connect').classList.remove('gold');}});
  $('remove').onclick=()=>{
    try{const n=doc.nodes.find(n=>n.id===selected),next=M.remove(doc,n.id);if(!confirm('删除“'+n.name+'”？可以用撤销恢复。'))return;dirty=false;selected=n.parent;commit(next);message('节点已删除，可撤销。');}catch(e){message(e.message,true);}
  };
  $('undo').onclick=()=>{if(!history.length)return;doc=M.validate(JSON.parse(history.pop()));if(!doc.nodes.some(n=>n.id===selected))selected=root().id;dirty=false;persist();render();message('已撤销上一步。');};
  $('arrange').onclick=()=>{if(!applyForm())return;commit(M.layout(doc));fit();message('已按上游关系整理；名称、效果与费用均保留。');};
  $('fit').onclick=fit;$('zoomIn').onclick=()=>{const r=map.getBoundingClientRect();zoomAt(r.left+r.width/2,r.top+r.height/2,1.2);};$('zoomOut').onclick=()=>{const r=map.getBoundingClientRect();zoomAt(r.left+r.width/2,r.top+r.height/2,1/1.2);};
  map.addEventListener('wheel',event=>{event.preventDefault();zoomAt(event.clientX,event.clientY,Math.exp(-Math.max(-150,Math.min(150,event.deltaY))*.002));},{passive:false});
  map.addEventListener('pointerdown',event=>{
    if(event.target.closest('.map-tools')||event.button>0)return;
    if(!applyForm())return;
    const node=event.target.closest('.tech');pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});map.setPointerCapture(event.pointerId);
    if(pointers.size===1)gesture={node:node?.dataset.id,startX:event.clientX,startY:event.clientY,lastX:event.clientX,lastY:event.clientY,moved:false,before:JSON.stringify(doc),pinched:false};
    else if(gesture){gesture.pinched=true;gesture.node=null;}
    event.preventDefault();
  });
  map.addEventListener('pointermove',event=>{
    if(!pointers.has(event.pointerId)||!gesture)return;
    const before=Array.from(pointers.values());pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});const after=Array.from(pointers.values());
    if(pointers.size>=2){
      const a=before.slice(0,2),b=after.slice(0,2),oldCenter={x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2},center={x:(b[0].x+b[1].x)/2,y:(b[0].y+b[1].y)/2};pan.x+=center.x-oldCenter.x;pan.y+=center.y-oldCenter.y;
      const d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),next=Math.hypot(b[0].x-b[1].x,b[0].y-b[1].y);if(d>2&&next>2)zoomAt(center.x,center.y,next/d);view();gesture.pinched=true;
    }else{
      const previous=before[0];if(Math.hypot(event.clientX-gesture.startX,event.clientY-gesture.startY)>5)gesture.moved=true;
      if(gesture.moved||gesture.pinched){
        const dx=event.clientX-previous.x,dy=event.clientY-previous.y;
        if(gesture.node&&!gesture.pinched){const n=doc.nodes.find(n=>n.id===gesture.node);n.x=Math.max(-19000,Math.min(19000,n.x+dx/zoom));n.y=Math.max(-19000,Math.min(19000,n.y+dy/zoom));renderGraph();}
        else{pan.x+=dx;pan.y+=dy;map.classList.add('panning');view();}
      }
    }
  });
  function end(event,cancelled=false){
    if(!pointers.has(event.pointerId))return;pointers.delete(event.pointerId);if(pointers.size)return;
    if(gesture){if(gesture.node&&gesture.moved){push(gesture.before);persist();}else if(gesture.node&&!gesture.pinched&&!cancelled)select(gesture.node);}
    gesture=null;map.classList.remove('panning');
  }
  map.addEventListener('pointerup',e=>end(e));map.addEventListener('pointercancel',e=>end(e,true));
  $('export').onclick=async()=>{
    if(!applyForm())return;
    const data=JSON.stringify({...doc,exportedAt:new Date().toISOString()},null,2),filename='科技树系统.json';
    try{
      if(window.showSaveFilePicker){const handle=await window.showSaveFilePicker({suggestedName:filename,types:[{description:'科技树规划',accept:{'application/json':['.json']}}]});const writer=await handle.createWritable();await writer.write(data);await writer.close();}
      else{const url=URL.createObjectURL(new Blob([data],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=filename;a.hidden=true;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
      message(window.showSaveFilePicker?'JSON已保存，可交给助手继续同步。':'已发起JSON下载。如浏览器拦截，可用“备份文本”另存。');
    }catch(e){if(e.name!=='AbortError')message('保存失败：'+e.message,true);}
  };
  $('backup').onclick=()=>{if(!applyForm())return;$('backupText').value=JSON.stringify(doc,null,2);$('backupDialog').showModal();};
  $('closeBackup').onclick=()=>$('backupDialog').close();
  $('selectBackup').onclick=()=>{$('backupText').focus();$('backupText').select();};
  $('import').onclick=()=>$('fileInput').click();
  $('fileInput').onchange=async(event)=>{
    const file=event.target.files[0];event.target.value='';if(!file)return;
    try{
      if(file.size>2000000)throw Error('规划文件不能超过2MB。');
      const next=M.validate(JSON.parse(await file.text()));
      if(!confirm('导入“'+(next.title||'科技树')+'”，替换当前草稿？可用撤销恢复。'))return;
      try{localStorage.setItem(KEY+'-before-import',JSON.stringify(doc));}catch{}
      push();doc=next;selected=root().id;dirty=false;writing=true;persist();render();fit();message('规划已导入。');
    }catch(e){message('未导入：'+e.message,true);}
  };
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  window.addEventListener('resize',view);
  function saveProjectDocument(snapshot){
    saveQueue=saveQueue.catch(()=>{}).then(async()=>{
      const text=JSON.stringify(snapshot);if(text===lastProjectDoc)return;
      try{
        const response=await fetch('/project-draft',{method:'POST',headers:{'Content-Type':'application/json','If-Match':projectRevision},body:JSON.stringify({document:snapshot})});const result=await response.json();
        if(!response.ok){if(response.status===409)projectConflict=true;throw Error(result.error||'项目保存失败');}
        projectRevision=result.revision;projectExists=true;projectConflict=false;lastProjectDoc=text;
        $('storageStatus').textContent='已保存到项目：科技树表格 / 科技树系统.json';
      }catch(e){message('项目存档未改动：'+e.message,true);}
    });return saveQueue;
  }
  async function loadProject(manual=false){
    if(location.protocol==='file:'){message('离线文件请用JSON另存；直接写入项目需从 http://127.0.0.1:7466 打开。');return;}
    const before=JSON.stringify(doc);
    try{
      const response=await fetch('/project-draft');const result=await response.json();if(!response.ok)throw Error(result.error||'项目存档读取失败');
      projectReady=true;projectRevision=result.revision;projectExists=result.exists;
      if(dirty||JSON.stringify(doc)!==before){projectConflict=true;message('读取期间有新修改，保留本机草稿；请点击保存到项目。');return;}
      if(result.exists){
        const next=M.validate(result.document),isSeed=JSON.stringify(M.validate(window.TECH_TREE_SEED))===JSON.stringify(doc);
        const same=JSON.stringify({...doc,projectSavedAt:null})===JSON.stringify({...next,projectSavedAt:null});
        if(!manual&&!same&&!isSeed){projectConflict=true;message('本机草稿与项目版本不同，已保留两份。可点“载入项目”查看文件，或“保存到项目”保存本机草稿。');return;}
        if(manual&&!same&&!confirm('载入项目文件？当前草稿仍可通过撤销恢复。'))return;
        if(manual)push();doc=next;selected=root().id;dirty=false;projectConflict=false;lastProjectDoc=JSON.stringify(doc);persist();render();fit();message('已载入项目中的科技树系统.json。');
      }else if(before!==JSON.stringify(M.validate(window.TECH_TREE_SEED))){
        await saveProjectDocument(M.clone(doc));message('已将原浏览器填写的草稿保存到项目目录。');
      }else $('storageStatus').textContent='尚未创建项目存档。填写后点击“保存到项目”。';
    }catch(e){projectReady=false;message('项目存档暂不可用，浏览器草稿保留：'+e.message,true);}
  }
  $('saveProject').onclick=async()=>{
    if(!applyForm())return;
    if(!projectReady){await loadProject(false);if(!projectReady)return;}
    if(projectConflict&&!confirm('将当前本机草稿保存到项目？原项目文件会先自动备份。'))return;
    if(projectConflict){
      try{const response=await fetch('/project-draft');const result=await response.json();if(!response.ok)throw Error(result.error||'读取版本失败');projectRevision=result.revision;lastProjectDoc='';}
      catch(e){message('项目存档未改动：'+e.message,true);return;}
    }
    projectConflict=false;await saveProjectDocument(M.clone(doc));
  };
  $('loadProject').onclick=()=>{if(applyForm())loadProject(true);};
  render();fit();persist();loadProject(false);
})();
