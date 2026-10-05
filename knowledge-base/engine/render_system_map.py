#!/usr/bin/env python3
from pathlib import Path
import json, sys, html

TEMPLATE=r"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ZDSM 十二宫系统图</title>
<style>
:root{--bg:#0e1116;--panel:#151a22;--text:#edf1f7;--muted:#9ba7b4;--line:#546171;--accent:#d7dde7}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
header{padding:24px 28px 8px}
h1{font-size:24px;margin:0 0 8px}
.sub{color:var(--muted);font-size:14px}
.wrap{display:grid;grid-template-columns:minmax(620px,1.6fr) minmax(320px,.7fr);gap:18px;padding:18px}
.card{background:var(--panel);border:1px solid #27303b;border-radius:16px;overflow:hidden}
#graph{width:100%;height:760px;display:block}
.side{padding:20px}
.node{cursor:pointer}
.node circle{fill:#1e2631;stroke:#758295;stroke-width:1.5}
.node.active circle{stroke-width:4}
.node.core circle{stroke:#e5e9ef;stroke-width:3}
.node text{fill:var(--text);text-anchor:middle;pointer-events:none}
.node .small{fill:var(--muted);font-size:11px}
.edge{fill:none;stroke:var(--line);stroke-width:1;opacity:.5}
.edge.functional{stroke-dasharray:6 5;opacity:.45}
.edge.opposite{stroke-width:2;opacity:.65}
.edge.self_transform{stroke-dasharray:2 4}
.legend{display:flex;gap:10px;flex-wrap:wrap;padding:0 28px 18px;color:var(--muted);font-size:12px}
.badge{padding:4px 8px;border:1px solid #394454;border-radius:999px}
#detail h2{margin-top:0}
#detail .tag{display:inline-block;border:1px solid #465466;border-radius:999px;padding:3px 8px;margin:2px;font-size:12px}
#detail ul{padding-left:20px}
.contact{margin:0 18px 18px;padding:18px;background:var(--panel);border:1px solid #27303b;border-radius:16px}
@media(max-width:900px){.wrap{grid-template-columns:1fr}#graph{height:620px}}
</style>
</head>
<body>
<header>
<h1>ZDSM 十二宫系统图</h1>
<div class="sub" id="subtitle"></div>
</header>
<div class="legend">
<span class="badge">实线：传统三合/对宫</span>
<span class="badge">虚线：ZDSM 功能链</span>
<span class="badge">粗边节点：本盘关键节点</span>
<span class="badge">高亮：当前时间层激活</span>
</div>
<div class="wrap">
<div class="card"><svg id="graph" viewBox="0 0 900 760"></svg></div>
<div class="card side" id="detail"><h2>点击任一宫位</h2><p class="sub">查看主星、系统角色、节点标签和当前激活层。</p></div>
</div>
<div class="contact" id="contact"></div>
<script>
const DATA=__GRAPH__;
const CONTACT=__CONTACT__;
document.getElementById("subtitle").textContent=(DATA.meta.profile?.solar_datetime||"")+" · "+(DATA.meta.profile?.lunar_datetime||"");
const svg=document.getElementById("graph");
const NS="http://www.w3.org/2000/svg";
const cx=450, cy=375, rx=330, ry=280;
const nodes={};
const n=DATA.nodes.length;
DATA.nodes.forEach((d,i)=>{
  const ang=(-Math.PI/2)+(i*2*Math.PI/n);
  nodes[d.id]={x:cx+rx*Math.cos(ang),y:cy+ry*Math.sin(ang),d};
});
function el(tag,attrs={}){
  const e=document.createElementNS(NS,tag);
  Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));
  return e;
}
function edgePath(a,b,curved=false){
  if(!curved) return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
  const dx=b.x-a.x,dy=b.y-a.y;
  const len=Math.sqrt(dx*dx+dy*dy)||1;
  const ox=-dy/len*28, oy=dx/len*28;
  return `M ${a.x} ${a.y} Q ${mx+ox} ${my+oy} ${b.x} ${b.y}`;
}
DATA.edges.forEach((e,idx)=>{
  const a=nodes[e.source],b=nodes[e.target];
  if(!a||!b)return;
  if(e.source===e.target)return;
  const p=el("path",{d:edgePath(a,b,e.edge_type==="functional"),class:`edge ${e.edge_type}`});
  const title=el("title"); title.textContent=`${e.label} · ${e.evidence_type}`; p.appendChild(title);
  svg.appendChild(p);
});
DATA.nodes.forEach((d,i)=>{
  const p=nodes[d.id];
  const g=el("g",{class:"node"+(d.activation_layers.length?" active":"")+(d.system_tags.length?" core":"")});
  const c=el("circle",{cx:p.x,cy:p.y,r:62});
  g.appendChild(c);
  const t=el("text",{x:p.x,y:p.y-12,"font-size":"16","font-weight":"700"});
  t.textContent=d.palace; g.appendChild(t);
  const b=el("text",{x:p.x,y:p.y+8,class:"small"}); b.textContent=d.stem_branch||d.branch; g.appendChild(b);
  const s=el("text",{x:p.x,y:p.y+27,class:"small"});
  s.textContent=(d.stars||[]).map(x=>x.name+(x.state?`(${x.state})`:"")).join(" / ")||"空宫"; g.appendChild(s);
  if(d.activation_layers.length){
    const a=el("text",{x:p.x,y:p.y+46,class:"small"}); a.textContent=d.activation_layers.join(" · "); g.appendChild(a);
  }
  g.addEventListener("click",()=>show(d));
  svg.appendChild(g);
});
function show(d){
  const tags=d.system_tags.map(x=>`<span class="tag">${x}</span>`).join("");
  const stars=(d.stars||[]).map(x=>`<li>${x.name}${x.state?` · ${x.state}`:""}${x.natal_transformation?` · ${x.natal_transformation}`:""}${x.self_transform?` · ${x.self_transform}`:""}</li>`).join("");
  const aux=(d.aux_stars||[]).map(x=>`<li>${x.name}${x.state?` · ${x.state}`:""}</li>`).join("");
  document.getElementById("detail").innerHTML=`
    <h2>${d.palace} · ${d.stem_branch||d.branch}</h2>
    <p>${d.role}</p>
    <div>${tags||'<span class="sub">无特殊系统标签</span>'}</div>
    <h3>主星</h3><ul>${stars||"<li>空宫</li>"}</ul>
    <h3>重要辅星</h3><ul>${aux||"<li>无</li>"}</ul>
    <h3>当前激活</h3><p>${d.activation_layers.join("、")||"无短周期直接激活"}</p>
    <h3>关联结论</h3><p class="sub">${d.claim_refs.length?d.claim_refs.join("<br>"):"暂无"}</p>
  `;
}
const c=document.getElementById("contact");
c.innerHTML=`<strong>${CONTACT.contact_title}</strong><p>${CONTACT.contact_text}</p>`+
CONTACT.channels.map(x=>`<div>${x.label}：${x.value}</div>`).join("");
</script>
</body></html>"""

if __name__=="__main__":
    if len(sys.argv)!=4:
        print("usage: python render_system_map.py graph.json contact.json output.html")
        raise SystemExit(2)
    graph=json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    contact=json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
    out=TEMPLATE.replace("__GRAPH__",json.dumps(graph,ensure_ascii=False)).replace("__CONTACT__",json.dumps(contact,ensure_ascii=False))
    Path(sys.argv[3]).write_text(out,encoding="utf-8")
    print(Path(sys.argv[3]))
