#!/usr/bin/env python3
from pathlib import Path
import json, sys

ROOT=Path(__file__).resolve().parents[1]
CFG=json.loads((ROOT/"data"/"daily_hourly_runtime_config.json").read_text(encoding="utf-8"))
ROLES=CFG["palace_roles"]; TRINES=CFG["trines"]; TM=CFG["transformations"]; ACTIONS=CFG["palace_actions"]; CONTEXTS=CFG["context_rules"]

ORDER=["decade","annual","minor_limit","monthly","daily","hourly"]
ZH={"decade":"大限","annual":"流年","minor_limit":"小限","monthly":"流月","daily":"流日","hourly":"流时"}
UPPER={"daily":["decade","annual","minor_limit","monthly"],"hourly":["decade","annual","minor_limit","monthly","daily"]}

def network(palace):
    t=TRINES[palace]
    return {
        "core":palace,
        "core_role":ROLES[palace],
        "trines":[{"palace":p,"role":ROLES[p]} for p in t["trines"]],
        "opposite":{"palace":t["opposite"],"role":ROLES[t["opposite"]]},
        "nodes":[palace,*t["trines"],t["opposite"]]
    }

def natal_trans(chart):
    out=[]
    for p in chart.get("palaces",[]):
        for s in p.get("major_stars",[]) or []:
            nt=s.get("natal_transformation")
            if nt:
                typ=nt.replace("生年","").replace("化","")
                if typ in TM:
                    out.append({"layer":"本命","star":s["name"],"type":typ,"target_palace":p["name"]})
    return out

def timed_trans(req):
    out=[]
    for layer in ORDER:
        x=req.get("time_layers",{}).get(layer)
        if not x: continue
        for t in x.get("transformations",[]) or []:
            out.append({"layer":ZH[layer],"layer_key":layer,"star":t["star"],"type":t["type"],"target_palace":t["target_palace"]})
    return out

def activation_map(req):
    d={}
    for layer in ORDER:
        x=req.get("time_layers",{}).get(layer)
        if x and x.get("palace"):
            d.setdefault(x["palace"],[]).append(ZH[layer])
    return d

def all_resonance(chart,req):
    acts=activation_map(req); nts=natal_trans(chart); tts=timed_trans(req)
    result=[]
    for palace in ROLES:
        evidence=[]; independent=set()
        for x in acts.get(palace,[]):
            evidence.append(f"{x}直接激活"); independent.add(x)
        for x in nts:
            if x["target_palace"]==palace:
                evidence.append(f"本命{x['star']}化{x['type']}"); independent.add("本命四化")
        for x in tts:
            if x["target_palace"]==palace:
                evidence.append(f"{x['layer']}{x['star']}化{x['type']}"); independent.add(x["layer"]+"四化")
        if not evidence: continue
        if len(independent)>=4: level="一级共振"
        elif len(independent)>=2: level="二级共振"
        else: level="三级提示"
        result.append({"palace":palace,"role":ROLES[palace],"level":level,"evidence":evidence,"independent_layers":len(independent)})
    rank={"一级共振":0,"二级共振":1,"三级提示":2}
    return sorted(result,key=lambda x:(rank[x["level"]],-x["independent_layers"],x["palace"]))

def support_status(req, layer):
    obj=req["time_layers"].get(layer)
    if not obj: return None
    p=obj["palace"]; pnet=set(network(p)["nodes"])
    upper_nodes=set()
    for up in UPPER[layer]:
        x=req["time_layers"].get(up)
        if not x: continue
        upper_nodes.add(x["palace"])
        if up in {"monthly","daily"}:
            upper_nodes.update(network(x["palace"])["nodes"])
        for t in x.get("transformations",[]) or []:
            upper_nodes.add(t["target_palace"])
    overlap=pnet & upper_nodes
    if p in upper_nodes and len(overlap)>=2:
        status="strong_short_term_signal"
    elif overlap:
        status="supported_short_term_signal"
    else:
        status="weak_short_term_signal"
    return {"layer":ZH[layer],"palace":p,"status":status,"overlap_with_upper":sorted(overlap)}

def trajectories(chart,req):
    order_index={"本命":0,"大限":1,"流年":2,"小限":3,"流月":4,"流日":5,"流时":6}
    rows=natal_trans(chart)
    rows += [{"layer":x["layer"],"star":x["star"],"type":x["type"],"target_palace":x["target_palace"]} for x in timed_trans(req)]
    by={}
    for x in rows: by.setdefault(x["star"],[]).append(x)
    out=[]
    for star,items in by.items():
        items.sort(key=lambda x:order_index[x["layer"]])
        if len(items)<2: continue
        types=[x["type"] for x in items]
        seq="→".join(types)
        prose=" → ".join(f"{x['layer']}：{TM[x['type']]['process']}（{x['target_palace']}）" for x in items)
        if len(set(types))==1:
            pattern=f"{types[0]}重复"
            interp=f"{star}的同一类机制被多层重复触发，属于持续性而不是单次信号。"
        elif "忌" in types[:-1] and types[-1] in {"科","禄"}:
            pattern="摩擦向整理/资源转化"
            interp=f"{star}呈现先有反复或卡点、后逐步转向整理或可用结果的过程。"
        elif types[0] in {"禄","权"} and types[-1]=="忌":
            pattern="资源/推动后出现成本"
            interp=f"{star}前段有资源或推动，短周期末端成本、占用或反复上升。"
        elif "科" in types and "禄" in types:
            pattern="整理与资源联动"
            interp=f"{star}的整理规范与资源化同时被激活，更适合把复杂事项变成可用成果。"
        else:
            pattern="多阶段转换"
            interp=f"{star}在不同时间层承担不同功能，不能做简单吉凶相抵，应按过程顺序解释。"
        out.append({"star":star,"sequence":seq,"pattern":pattern,"steps":items,"process":prose,"interpretation":interp})
    return out

def bridge_signals(req):
    out=[]
    for from_layer,to_layer in [("monthly","daily"),("daily","hourly")]:
        a=req["time_layers"].get(from_layer); b=req["time_layers"].get(to_layer)
        if not a or not b: continue
        bnet=set(network(b["palace"])["nodes"])
        for t in a.get("transformations",[]) or []:
            if t["target_palace"] in bnet:
                out.append({
                    "from_layer":ZH[from_layer],"to_layer":ZH[to_layer],
                    "star":t["star"],"type":t["type"],
                    "target_palace":t["target_palace"],
                    "meaning":f"{ZH[from_layer]}的{t['star']}化{t['type']}直接落入{ZH[to_layer]}三方四正网络"
                })
    return out

def context_assessment(req, daily_net, hourly_net, resonances, trajectories):
    ctx_key=req.get("event_context") or "general"
    ctx=CONTEXTS.get(ctx_key,CONTEXTS["general"])
    current=hourly_net or daily_net
    nodes=set(current["nodes"])
    relevance=[p for p in ctx["relevant"] if p in nodes]
    # final focus
    focus=current["core"]
    suitable=list(ACTIONS[focus])
    for p in relevance:
        for a in ACTIONS[p]:
            if a not in suitable: suitable.append(a)
    # risks from 忌 in current network or first-class resonance
    risks=[]
    for layer in ["daily","hourly"]:
        x=req["time_layers"].get(layer)
        if not x: continue
        for t in x.get("transformations",[]) or []:
            if t["type"]=="忌" and t["target_palace"] in nodes:
                risks.append(f"{ZH[layer]}{t['star']}化忌落{t['target_palace']}：该环节更容易反复、占用时间或增加成本。")
    for r in resonances:
        if r["level"]=="一级共振" and r["palace"] in nodes:
            risks.append(f"{r['palace']}为一级共振节点：短时间内更容易成为注意力集中点。")
    # best concise tactic
    if focus=="田宅宫":
        tactic="先把沟通或想法结构化，再落成文字、文件、方案或可复用成果。"
    elif focus=="夫妻宫":
        tactic="先确认双方目标、责任和条件，再推进承诺。"
    elif focus=="官禄宫":
        tactic="先明确结果标准，再推进执行，避免边做边重新定义任务。"
    elif focus=="子女宫":
        tactic="先给结论，再给证据；控制临场扩张与无止境解释。"
    elif focus=="财帛宫":
        tactic="先确认价格、预算、付款和成本，再决定是否投入。"
    else:
        tactic=f"围绕{focus}对应事项处理核心任务，并用其三方四正检查资源与牵制。"
    return {
        "event_context":ctx_key,
        "event_label":ctx["label"],
        "final_focus_palace":focus,
        "final_focus_role":ROLES[focus],
        "context_network_overlap":relevance,
        "more_suitable_for":suitable[:6],
        "watch_out_for":list(dict.fromkeys(risks))[:6],
        "execution_tactic":tactic
    }

def summary(req, daily_net, hourly_net, bridges, traj):
    month=req["time_layers"]["monthly"]["palace"]; day=req["time_layers"]["daily"]["palace"]
    if hourly_net:
        hour=req["time_layers"]["hourly"]["palace"]
        base=f"本月焦点在{month}，当天流日进入{day}，当前时段流时进入{hour}。"
        if month==day:
            base+=f" 流月与流日重复命中{day}，说明该领域不是单次闪现，而是月度主题在当天被再次推到前台。"
        if bridges:
            base+=" 日时之间存在四化桥接："+"；".join(x["meaning"] for x in bridges[:2])+"。"
        if traj:
            base+=" 其中"+traj[0]["star"]+"形成“"+traj[0]["sequence"]+"”过程链，应按阶段变化而不是吉凶相抵解释。"
        return base
    return f"本月焦点在{month}，当天流日进入{day}。日运只负责推进月运已有主题，不单独创造新的长期剧情。"

def quality(req):
    issues=[]
    for k in ["decade","annual","monthly","daily"]:
        x=req.get("time_layers",{}).get(k)
        if not x or not x.get("palace"): issues.append("missing_"+k)
        elif not x.get("computed_upstream",False): issues.append(k+"_not_computed_upstream")
    h=req.get("time_layers",{}).get("hourly")
    if req.get("time_window") and not h:
        issues.append("time_window_present_but_hourly_missing")
    if h and not h.get("computed_upstream",False): issues.append("hourly_not_computed_upstream")
    return {"status":"pass" if not issues else "fail","issues":issues}

def analyze(chart,req):
    daily_net=network(req["time_layers"]["daily"]["palace"])
    hourly_obj=req["time_layers"].get("hourly")
    hourly_net=network(hourly_obj["palace"]) if hourly_obj else None
    res=all_resonance(chart,req)
    traj=trajectories(chart,req)
    bridges=bridge_signals(req)
    assess=context_assessment(req,daily_net,hourly_net,res,traj)
    layers=[]
    for k in ORDER:
        x=req["time_layers"].get(k)
        if x:
            layers.append({"layer":ZH[k],"palace":x["palace"],"role":ROLES[x["palace"]]})
    return {
        "meta":{
            "engine":"ZDSM Daily/Hourly Runtime","version":"1.0",
            "target_date":req.get("target_date"),
            "time_window":req.get("time_window"),
            "calendar_label":req.get("calendar_label"),
            "event_context":req.get("event_context","general"),
            "ai_api_used":False
        },
        "layer_chain":layers,
        "networks":{
            "monthly":network(req["time_layers"]["monthly"]["palace"]),
            "daily":daily_net,
            "hourly":hourly_net
        },
        "short_term_support":{
            "daily":support_status(req,"daily"),
            "hourly":support_status(req,"hourly") if hourly_obj else None
        },
        "resonance_nodes":res,
        "transformation_trajectories":traj,
        "bridge_signals":bridges,
        "summary":summary(req,daily_net,hourly_net,bridges,traj),
        "window_assessment":assess,
        "quality_gate":quality(req)
    }

if __name__=="__main__":
    if len(sys.argv)!=3:
        print("usage: python daily_hourly_runtime.py chart.json request.json")
        raise SystemExit(2)
    chart=json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    req=json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
    print(json.dumps(analyze(chart,req),ensure_ascii=False,indent=2))
