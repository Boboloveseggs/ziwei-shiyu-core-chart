import { level } from "./engine.js";

const NS = "http://www.w3.org/2000/svg";
function el(tag,attrs={},text=""){
  const x = document.createElementNS(NS,tag);
  for(const [k,v] of Object.entries(attrs)) x.setAttribute(k,v);
  if(text) x.textContent = text;
  return x;
}
function clear(svg){ while(svg.firstChild) svg.removeChild(svg.firstChild); }

function palette(node,res){
  if(node.name===res.bottleneck?.name) return "#f0b94b";
  if(node.name===res.storage?.name) return "#68d391";
  if(node.name===res.processor?.name || node.name===res.engine?.name) return "#58d5ef";
  if(node.friction>=3) return "#f27c7c";
  return "#90aaf5";
}

export function renderSystem(svg,res,{animate=true}={}){
  clear(svg);
  svg.setAttribute("viewBox","0 0 1100 560");

  const defs = el("defs");
  const marker = el("marker",{id:"arrow",markerWidth:"10",markerHeight:"10",refX:"8",refY:"3",orient:"auto"});
  marker.appendChild(el("path",{d:"M0,0 L0,6 L9,3 z",fill:"#7384a6"}));
  defs.appendChild(marker);
  svg.appendChild(defs);

  const P = {
    input0:[90,130],input1:[90,260],input2:[90,390],
    engine:[295,260],
    processor:[520,260],
    output0:[735,165],output1:[735,350],
    storage:[960,165],
    recovery:[960,350]
  };

  const nodes = [];
  res.inputs.slice(0,3).forEach((x,i)=>nodes.push({key:`input${i}`,data:x}));
  nodes.push({key:"engine",data:res.engine});
  nodes.push({key:"processor",data:res.processor});
  if(res.outputs[0]) nodes.push({key:"output0",data:res.outputs[0]});
  if(res.outputs[1]) nodes.push({key:"output1",data:res.outputs[1]});
  nodes.push({key:"storage",data:res.storage});
  nodes.push({key:"recovery",data:res.recovery});

  const keyByName = new Map(nodes.map(n=>[n.data.name,n.key]));
  const nodeByKey = Object.fromEntries(nodes.map(n=>[n.key,n]));
  const posByName = name => {
    const k = keyByName.get(name);
    return k ? P[k] : null;
  };

  // headers
  [
    ["主要入口",90],["发动",295],["处理核心",520],["主要输出",735],["积累 / 恢复",960]
  ].forEach(([t,x])=>svg.appendChild(el("text",{x,y:45,fill:"#6f82a8","font-size":"13","text-anchor":"middle"},t)));

  const visibleEdges = res.edges
    .filter(e=>posByName(e.source)&&posByName(e.target))
    .sort((a,b)=>b.priority-a.priority);

  const animatedLines = [];
  for(const e of visibleEdges){
    const [x1,y1]=posByName(e.source), [x2,y2]=posByName(e.target);
    const line = el("line",{
      x1,y1,x2,y2,stroke:"#657697",
      "stroke-width":e.priority>=4?2.6:1.7,
      "marker-end":"url(#arrow)",opacity:e.priority>=4?".78":".42"
    });
    svg.appendChild(line);

    const tx=(x1+x2)/2, ty=(y1+y2)/2-8;
    svg.appendChild(el("text",{x:tx,y:ty,fill:"#94a4c2","font-size":"11","text-anchor":"middle"},e.label));

    if(e.priority>=4) animatedLines.push({e,x1,y1,x2,y2});
  }

  // nodes
  for(const n of nodes){
    const [x,y]=P[n.key];
    const d=n.data;
    const group = el("g",{"data-node":d.name});
    group.appendChild(el("rect",{
      x:x-72,y:y-36,width:144,height:72,rx:15,
      fill:"#101a2e",stroke:palette(d,res),"stroke-width":"2"
    }));
    group.appendChild(el("text",{x,y:y-6,fill:"#f2f6ff","font-size":"16","font-weight":"700","text-anchor":"middle"},d.name));
    group.appendChild(el("text",{x,y:y+17,fill:"#96a7c7","font-size":"11","text-anchor":"middle"},
      `${level(d.strength)} · 摩擦 ${d.friction.toFixed(1)}`
    ));
    if((d.activationBonus||0)>0){
      group.appendChild(el("circle",{cx:x+57,cy:y-26,r:7,fill:"#c084fc"}));
    }
    svg.appendChild(group);
  }

  // animation: moving dots only on main high-priority edges
  if(animate && animatedLines.length){
    const particles = animatedLines.map((l,i)=>{
      const c=el("circle",{r:"4.5",fill:"#e7fbff",opacity:".95"});
      svg.appendChild(c);
      return {c,l,phase:i/animatedLines.length};
    });

    let start=null;
    function tick(ts){
      if(!document.body.contains(svg)) return;
      if(start===null) start=ts;
      const t=((ts-start)/3200)%1;
      for(const p of particles){
        const u=(t+p.phase)%1;
        const x=p.l.x1+(p.l.x2-p.l.x1)*u;
        const y=p.l.y1+(p.l.y2-p.l.y1)*u;
        p.c.setAttribute("cx",x);
        p.c.setAttribute("cy",y);
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
}

export function renderScoreBars(container,res){
  const rows=[...res.scores].sort((a,b)=>b.strength-a.strength);
  container.innerHTML = rows.map(x=>{
    const w=Math.max(4,Math.round(x.strength/5*100));
    return `<div class="bar-row">
      <div class="bar-name">${x.name}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${w}%"></div></div>
      <div class="bar-value">${x.strength.toFixed(2)}</div>
    </div>`;
  }).join("");
}
