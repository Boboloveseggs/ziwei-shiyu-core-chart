#!/usr/bin/env python3
from pathlib import Path
import json,sys
TEMPLATE=r"""<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ZDSM 日时运行分析</title>
<style>
body{margin:0;background:#0c1015;color:#edf2f7;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}.wrap{max-width:1120px;margin:auto;padding:24px}.card{background:#151b23;border:1px solid #27303b;border-radius:16px;padding:18px;margin:14px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.chain{display:flex;gap:8px;flex-wrap:wrap}.pill{border:1px solid #405066;border-radius:999px;padding:6px 10px}.muted{color:#98a5b3}.node{border-left:3px solid #74859b;padding:10px 12px;background:#111720;border-radius:8px;margin:8px 0}.good{border-left-color:#d7dde7}.warn{border-left-style:dashed}@media(max-width:760px){.grid{grid-template-columns:1fr}}</style></head>
<body><div class="wrap"><h1 id="title"></h1><div class="muted">本命 → 大限 → 流年 → 小限 → 流月 → 流日 → 流时</div>
<div class="card"><div id="chain" class="chain"></div><h2>这一时段怎么理解</h2><p id="summary"></p></div>
<div class="grid"><div class="card"><h2>月 / 日 / 时网络</h2><div id="nets"></div></div><div class="card"><h2>这个时段适合什么</h2><div id="assess"></div></div></div>
<div class="grid"><div class="card"><h2>多层共振</h2><div id="res"></div></div><div class="card"><h2>四化过程链</h2><div id="traj"></div></div></div>
<div class="card"><h2>跨层桥接</h2><div id="bridges"></div></div>
<div class="card" id="contact"></div>
</div><script>
const D=__DATA__,C=__CONTACT__;
document.getElementById("title").textContent=(D.meta.target_date||"")+" "+(D.meta.time_window||"")+" 日时运行分析";
document.getElementById("summary").textContent=D.summary;
D.layer_chain.forEach((x,i)=>{let s=document.createElement("span");s.className="pill";s.textContent=`${x.layer} · ${x.palace}`;document.getElementById("chain").appendChild(s)});
const nets=document.getElementById("nets");
for(const [k,n] of Object.entries(D.networks)){if(!n)continue;let x=document.createElement("div");x.className="node";x.innerHTML=`<b>${k}</b>：${n.core}<div class="muted">三合：${n.trines.map(z=>z.palace).join("、")}｜对宫：${n.opposite.palace}</div>`;nets.appendChild(x)}
const A=D.window_assessment;document.getElementById("assess").innerHTML=`<div class="node good"><b>最终焦点：${A.final_focus_palace}</b><div class="muted">${A.final_focus_role}</div></div><p><b>更适合：</b>${A.more_suitable_for.join("、")}</p><p><b>执行策略：</b>${A.execution_tactic}</p><p><b>注意：</b>${A.watch_out_for.join("；")||"没有额外高权重短周期风险提示。"}</p>`;
D.resonance_nodes.slice(0,8).forEach(r=>{let x=document.createElement("div");x.className="node";x.innerHTML=`<b>${r.level} · ${r.palace}</b><div class="muted">${r.evidence.join("；")}</div>`;document.getElementById("res").appendChild(x)});
D.transformation_trajectories.forEach(r=>{let x=document.createElement("div");x.className="node";x.innerHTML=`<b>${r.star}：${r.sequence}</b><div>${r.interpretation}</div><div class="muted">${r.process}</div>`;document.getElementById("traj").appendChild(x)});
if(!D.transformation_trajectories.length) document.getElementById("traj").innerHTML='<span class="muted">没有形成跨层四化过程链。</span>';
D.bridge_signals.forEach(r=>{let x=document.createElement("div");x.className="node warn";x.textContent=r.meaning;document.getElementById("bridges").appendChild(x)});
if(!D.bridge_signals.length) document.getElementById("bridges").innerHTML='<span class="muted">没有检测到月→日或日→时的直接四化桥接。</span>';
document.getElementById("contact").innerHTML=`<h2>${C.contact_title||"对报告还有疑问？"}</h2><p>${C.contact_text||"联系人工解读。"}</p>`+(C.channels||[]).map(x=>`<div>${x.label}：${x.value}</div>`).join("");
</script></body></html>"""
if __name__=="__main__":
    if len(sys.argv)!=4:
        print("usage: python render_daily_hourly.py output.json contact.json page.html"); raise SystemExit(2)
    d=json.loads(Path(sys.argv[1]).read_text(encoding="utf-8")); c=json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
    Path(sys.argv[3]).write_text(TEMPLATE.replace("__DATA__",json.dumps(d,ensure_ascii=False)).replace("__CONTACT__",json.dumps(c,ensure_ascii=False)),encoding="utf-8")
    print(Path(sys.argv[3]))
