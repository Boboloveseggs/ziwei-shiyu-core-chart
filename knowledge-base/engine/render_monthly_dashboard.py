#!/usr/bin/env python3
from pathlib import Path
import json, sys

TEMPLATE=r"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ZDSM 月度运行仪表盘</title>
<style>
:root{--bg:#0c1015;--panel:#151b23;--text:#edf2f7;--muted:#98a5b3;--line:#465261;--focus:#f1f5f9;--soft:#7f8ea3}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
header{padding:24px 26px 8px}.sub{color:var(--muted)}.grid{display:grid;grid-template-columns:1.25fr .75fr;gap:16px;padding:16px 24px}
.card{background:var(--panel);border:1px solid #27303b;border-radius:16px;padding:18px}
svg{width:100%;height:620px}.edge{stroke:var(--line);stroke-width:1.2;opacity:.5}.edge.core{stroke-width:3;opacity:.9}.node circle{fill:#1c2430;stroke:#627084;stroke-width:1.5}
.node.monthly circle{stroke:var(--focus);stroke-width:5}.node.trine circle{stroke-width:3}.node.opposite circle{stroke-dasharray:5 4;stroke-width:3}
.node text{fill:var(--text);text-anchor:middle}.small{fill:var(--muted);font-size:11px}
.chain{display:flex;gap:8px;flex-wrap:wrap}.pill{border:1px solid #394657;border-radius:999px;padding:6px 10px;font-size:13px}.arrow{color:var(--muted);align-self:center}
.key{margin:10px 0;padding:12px;border-left:3px solid #7f8ea3;background:#111720;border-radius:8px}.key strong{display:block;margin-bottom:4px}
.axis{margin:10px 0}.axis b{display:inline-block;min-width:90px}.tag{font-size:12px;border:1px solid #3b4656;border-radius:999px;padding:3px 7px;margin-left:6px}
.contact{margin:0 24px 24px}.contact strong{display:block;margin-bottom:8px}
@media(max-width:900px){.grid{grid-template-columns:1fr}svg{height:520px}}
</style>
</head><body>
<header><h1 id="title"></h1><div class="sub">大限 → 流年 → 小限 → 流月 → 流月三方四正 → 月四化 → 共振节点</div></header>
<div class="grid">
  <div class="card"><svg id="map" viewBox="0 0 900 620"></svg></div>
  <div>
    <div class="card">
      <h2>本月运行链</h2><div id="chain" class="chain"></div>
      <h2>一句话</h2><p id="summary"></p>
      <h2>关键节点</h2><div id="keys"></div>
    </div>
    <div class="card" style="margin-top:16px"><h2>四大现实轴</h2><div id="axes"></div></div>
  </div>
</div>
<div class="card contact"><strong>本月行动</strong><ul id="actions"></ul></div>
<div class="card contact" id="contact"></div>
<script>
const D=__DATA__, C=__CONTACT__;
document.getElementById("title").textContent=(D.meta.target_month||"")+" 月度运行仪表盘";
document.getElementById("summary").textContent=D.monthly_summary;
const chain=document.getElementById("chain");
D.layer_chain.forEach((x,i)=>{
 const p=document.createElement("span");p.className="pill";p.textContent=`${x.layer} · ${x.palace}`;chain.appendChild(p);
 if(i<D.layer_chain.length-1){const a=document.createElement("span");a.className="arrow";a.textContent="→";chain.appendChild(a);}
});
const keyNames={core_focus:"核心宫",opportunity_node:"机会承接",bottleneck_node:"最大瓶颈",opposite_tension:"对宫拉扯"};
const keys=document.getElementById("keys");
Object.entries(D.key_nodes).forEach(([k,v])=>{
 const div=document.createElement("div");div.className="key";
 div.innerHTML=`<strong>${keyNames[k]}：${v.palace}</strong><span class="sub">${v.role}</span><div>${Array.isArray(v.reason)?v.reason.join("；"):v.reason}</div>`;
 keys.appendChild(div);
});
const axes=document.getElementById("axes");
Object.entries(D.axes).forEach(([k,v])=>{
 const div=document.createElement("div");div.className="axis";
 div.innerHTML=`<b>${k}</b><span class="tag">${v.relevance}</span><div class="sub">${v.summary}</div>`;
 axes.appendChild(div);
});
const acts=document.getElementById("actions");D.monthly_actions.forEach(x=>{const li=document.createElement("li");li.textContent=x;acts.appendChild(li)});
document.getElementById("contact").innerHTML=`<strong>${C.contact_title||"对报告还有疑问？"}</strong><div>${C.contact_text||"联系人工解读。"}</div>`+
(C.channels||[]).map(x=>`<div>${x.label}：${x.value}</div>`).join("");

const svg=document.getElementById("map"),NS="http://www.w3.org/2000/svg";
const palaces=["命宫","兄弟宫","夫妻宫","子女宫","财帛宫","疾厄宫","迁移宫","交友宫","官禄宫","田宅宫","福德宫","父母宫"];
const cx=450,cy=310,rx=330,ry=235,nodes={};
palaces.forEach((p,i)=>{const a=-Math.PI/2+i*2*Math.PI/12;nodes[p]={x:cx+rx*Math.cos(a),y:cy+ry*Math.sin(a)}});
function e(tag,attrs={}){const x=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>x.setAttribute(k,v));return x}
const net=D.monthly_core_network, core=net.core, tris=new Set(net.trines.map(x=>x.palace)), opp=net.opposite.palace;
[...tris].forEach(t=>{const p=e("line",{x1:nodes[core].x,y1:nodes[core].y,x2:nodes[t].x,y2:nodes[t].y,class:"edge core"});svg.appendChild(p)});
svg.appendChild(e("line",{x1:nodes[core].x,y1:nodes[core].y,x2:nodes[opp].x,y2:nodes[opp].y,class:"edge core"}));
palaces.forEach(p=>{
 const g=e("g",{class:"node "+(p===core?"monthly":tris.has(p)?"trine":p===opp?"opposite":"")});
 g.appendChild(e("circle",{cx:nodes[p].x,cy:nodes[p].y,r:48}));
 let t=e("text",{x:nodes[p].x,y:nodes[p].y-4,"font-size":"15","font-weight":"700"});t.textContent=p;g.appendChild(t);
 let s=e("text",{x:nodes[p].x,y:nodes[p].y+16,class:"small"});s.textContent=(D.layer_chain.filter(x=>x.palace===p).map(x=>x.layer).join(" · "));g.appendChild(s);
 svg.appendChild(g)
});
</script></body></html>"""

if __name__=="__main__":
    if len(sys.argv)!=4:
        print("usage: python render_monthly_dashboard.py monthly_output.json contact.json output.html")
        raise SystemExit(2)
    d=json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    c=json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
    html=TEMPLATE.replace("__DATA__",json.dumps(d,ensure_ascii=False)).replace("__CONTACT__",json.dumps(c,ensure_ascii=False))
    Path(sys.argv[3]).write_text(html,encoding="utf-8")
    print(Path(sys.argv[3]))
