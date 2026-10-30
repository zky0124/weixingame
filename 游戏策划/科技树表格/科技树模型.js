(function (global) {
  'use strict';
  const colors = ['#6eb6dc','#b491e4','#75bc95','#e6b85f','#e98e81','#82c8be','#a8b770','#d991bd'];
  const clone = value => JSON.parse(JSON.stringify(value));
  const cleanNumber = (value, title, integer = false) => {
    if (value === null || value === '' || value === undefined) return null;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (integer && !Number.isInteger(value))) throw Error(title+'须为非负数字，未确定时留空。');
    return value;
  };
  function validate(value) {
    if (!value || value.version !== 1 || !Array.isArray(value.nodes) || !value.nodes.length || value.nodes.length > 240) throw Error('请导入本规划器的JSON文件，节点数须在1—240之间。');
    const doc = clone(value), ids = new Set();
    for (const node of doc.nodes) {
      if (!node || typeof node.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(node.id) || ids.has(node.id)) throw Error('科技编号无效或重复。');
      ids.add(node.id);
      if (typeof node.name !== 'string' || !node.name.trim() || node.name.length > 120) throw Error('科技名称不能为空，最多120字。');
      for (const key of ['effect','conditions','units','buildings','notes','branch','status','source','existing']) {
        if (node[key] == null) node[key]='';
        if (typeof node[key] !== 'string' || node[key].length > 12000) throw Error('科技说明过长或格式错误。');
      }
      for (const key of ['points','coins','seconds']) node[key]=cleanNumber(node[key],key==='points'?'研究点':key==='coins'?'铜币':'耗时');
      node.level=cleanNumber(node.level??1,'等级',true);
      if (node.level === 0 || node.level === null) throw Error('科技等级须为正整数。');
      if (!Number.isFinite(node.x) || !Number.isFinite(node.y) || Math.abs(node.x)>20000 || Math.abs(node.y)>20000) throw Error('节点位置超出范围。');
      if (!/^#[0-9a-f]{6}$/i.test(node.color??'')) node.color=colors[0];
      if (!Array.isArray(node.requires)) node.requires=[];
      node.requires=Array.from(new Set(node.requires));
      if (node.requires.some(id=>typeof id!=='string')) throw Error('前置科技编号格式错误。');
      node.mode=node.mode==='any'?'any':'all';
    }
    const roots=doc.nodes.filter(n=>n.parent===null);
    if (roots.length!==1) throw Error('科技树须有且只有一个中心研究塔。');
    const root=roots[0];
    if (root.requires.length) throw Error('中心研究塔不能有前置科技。');
    for(const n of doc.nodes) {
      if(n!==root && !ids.has(n.parent)) throw Error(n.name+'的上游节点不存在。');
      for(const id of n.requires) if(!ids.has(id)) throw Error(n.name+'引用了不存在的科技：'+id);
    }
    const map=new Map(doc.nodes.map(n=>[n.id,n])), done=new Set(), visiting=new Set();
    function visit(id) {
      if(visiting.has(id)) throw Error('前置条件存在循环，请调整上游或额外前置科技。');
      if(done.has(id)) return;
      visiting.add(id);const n=map.get(id);
      for(const dep of [n.parent,...n.requires].filter(Boolean)) visit(dep);
      visiting.delete(id);done.add(id);
    }
    for(const n of doc.nodes)visit(n.id);
    doc.title=typeof doc.title==='string'?doc.title.slice(0,120):'研究塔科技规划';
    return doc;
  }
  function layout(value) {
    const doc=clone(value),root=doc.nodes.find(n=>n.parent===null);root.x=0;root.y=0;
    const children=id=>doc.nodes.filter(n=>n.parent===id);
    function spread(parent,start,end,depth) {
      const list=children(parent);
      list.forEach((n,i)=>{
        const step=(end-start)/list.length,angle=start+step*(i+0.5),radius=depth*290;
        n.x=Math.round(Math.cos(angle)*radius);n.y=Math.round(Math.sin(angle)*radius);
        spread(n.id,angle-step*.42,angle+step*.42,depth+1);
      });
    }
    spread(root.id,-Math.PI*.5-Math.PI/(Math.max(1,children(root.id).length)),Math.PI*1.5-Math.PI/(Math.max(1,children(root.id).length)),1);
    return validate(doc);
  }
  function add(value,parentId) {
    const doc=clone(value),p=doc.nodes.find(n=>n.id===parentId);
    if(!p)throw Error('请先选一个上游科技点。');
    let i=1;while(doc.nodes.some(n=>n.id==='T'+String(i).padStart(3,'0')))i++;
    const root=p.parent===null, angle=root?doc.nodes.filter(n=>n.parent===p.id).length*2.39996:Math.atan2(p.y,p.x);
    let x=0,y=0;
    for(let attempt=0;attempt<40;attempt++){
      const a=angle+(attempt%2?1:-1)*Math.ceil(attempt/2)*.35,radius=220+Math.floor(attempt/12)*100;
      x=Math.round(p.x+Math.cos(a)*radius);y=Math.round(p.y+Math.sin(a)*radius);
      if(doc.nodes.every(n=>Math.hypot(n.x-x,n.y-y)>165))break;
    }
    const node={id:'T'+String(i).padStart(3,'0'),parent:p.id,name:root?'新分支':'新科技',branch:root?'新分支':p.branch,color:root?colors[doc.nodes.filter(n=>n.parent===p.id).length%colors.length]:p.color,level:1,points:null,coins:null,seconds:null,effect:'',conditions:'',units:'',buildings:'',existing:'',status:'待填写',notes:'',source:'用户在规划器新增',requires:[],mode:'all',x,y};
    doc.nodes.push(node);return {doc:validate(doc),id:node.id};
  }
  function update(value,id,patch) {
    const doc=clone(value),node=doc.nodes.find(n=>n.id===id);if(!node)throw Error('节点不存在。');
    Object.assign(node,patch,{id:node.id});return validate(doc);
  }
  function remove(value,id) {
    const n=value.nodes.find(n=>n.id===id);if(!n||n.parent===null)throw Error('中心研究塔不能删除。');
    if(value.nodes.some(n=>n.parent===id||n.requires.includes(id)))throw Error('还有科技依赖此点，请先调整它们的上游或前置条件。');
    const doc=clone(value);doc.nodes=doc.nodes.filter(n=>n.id!==id);return validate(doc);
  }
  const api={validate,layout,add,update,remove,clone,colors};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else global.TechTreeModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
