#!/usr/bin/env python3
from pathlib import Path
import json, sys

ROOT=Path(__file__).resolve().parents[1]
CFG=json.loads((ROOT/"data"/"monthly_runtime_config.json").read_text(encoding="utf-8"))
PALACE_ROLES=CFG["palace_roles"]
TRINES=CFG["trines"]
TRANS=CFG["transform_meanings"]
AXIS=CFG["axis_palaces"]

LAYER_ZH={"decade":"大限","annual":"流年","minor_limit":"小限","monthly":"流月"}
LAYER_ORDER=["decade","annual","minor_limit","monthly"]

SUPPORT_OPS={"support","buffering"}
FRICTION_OPS={"disruption","decoupling","amplification"}

def chart_by_palace(chart):
    return {p["name"]:p for p in chart.get("palaces",[])}

def normalize_transformations(req):
    out=[]
    for layer in LAYER_ORDER:
        obj=req.get("time_layers",{}).get(layer) or {}
        for t in obj.get("transformations",[]) or []:
            out.append({
                "layer":LAYER_ZH[layer],
                "star":t["star"],
                "type":t["type"],
                "target_palace":t["target_palace"],
                "meaning":TRANS[t["type"]]
            })
    return out

def monthly_network(monthly_palace):
    x=TRINES[monthly_palace]
    return {
        "core":monthly_palace,
        "core_role":PALACE_ROLES[monthly_palace],
        "trines":[
            {"palace":p,"role":PALACE_ROLES[p]} for p in x["trines"]
        ],
        "opposite":{
            "palace":x["opposite"],
            "role":PALACE_ROLES[x["opposite"]]
        },
        "interpretation_rule":"流月命宫是本月注意力与事件入口；三合宫提供同一事件系统的资源/承接；对宫体现拉扯、外部要求或需要协调的另一端。"
    }

def activation_layers(req):
    out={}
    for layer in LAYER_ORDER:
        x=req.get("time_layers",{}).get(layer)
        if x and x.get("palace"):
            out.setdefault(x["palace"],[]).append(LAYER_ZH[layer])
    return out

def transformation_hits(req):
    hits={}
    for t in normalize_transformations(req):
        hits.setdefault(t["target_palace"],[]).append(t)
    return hits

def natal_transform_hits(chart):
    hits={}
    for p in chart.get("palaces",[]):
        for s in p.get("major_stars",[]) or []:
            nt=s.get("natal_transformation")
            if nt:
                typ=nt.replace("生年","").replace("化","")
                if typ in TRANS:
                    hits.setdefault(p["name"],[]).append({
                        "layer":"本命","star":s["name"],"type":typ,
                        "target_palace":p["name"],"meaning":TRANS[typ]
                    })
    return hits

def palace_condition(chart_palace):
    support=[]
    friction=[]
    low_state=[]
    high_state=[]
    for s in chart_palace.get("major_stars",[]) or []:
        st=s.get("state")
        if st in {"庙","旺","得地","利","得"}: high_state.append(f"{s['name']}({st})")
        if st in {"陷","不得地","不"}: low_state.append(f"{s['name']}({st})")
    for s in chart_palace.get("aux_stars",[]) or []:
        name=s.get("name","")
        if name in {"左辅","右弼","文昌","文曲","天魁","天钺","禄存","解神","恩光","天贵","三台","八座"}:
            support.append(name)
        if name in {"擎羊","陀罗","火星","铃星","天空","地空","地劫","截空","破碎","天哭","天虚"}:
            friction.append(name)
    return {
        "support":support,"friction":friction,
        "high_state":high_state,"low_state":low_state
    }

def resonance(chart, req):
    acts=activation_layers(req)
    trans=transformation_hits(req)
    natal=natal_transform_hits(chart)
    result=[]
    for palace in PALACE_ROLES:
        layers=acts.get(palace,[])
        t=trans.get(palace,[])
        n=natal.get(palace,[])
        evidence=[]
        evidence += [f"{x}直接激活" for x in layers]
        evidence += [f"{x['layer']} {x['star']}化{x['type']}" for x in t]
        evidence += [f"本命 {x['star']}化{x['type']}" for x in n]
        independent=set(layers)
        if t: independent.add("四化")
        if n: independent.add("本命四化")
        if len(independent)>=3:
            level="一级共振"
        elif len(independent)==2:
            level="二级共振"
        elif evidence:
            level="三级提示"
        else:
            continue
        result.append({
            "palace":palace,
            "role":PALACE_ROLES[palace],
            "level":level,
            "evidence":evidence
        })
    order={"一级共振":0,"二级共振":1,"三级提示":2}
    return sorted(result,key=lambda x:(order[x["level"]],x["palace"]))

def choose_key_nodes(chart, req, network, resonances):
    P=chart_by_palace(chart)
    month_trans=(req["time_layers"]["monthly"].get("transformations",[]) or [])
    network_palaces=[network["core"]]+[x["palace"] for x in network["trines"]]+[network["opposite"]["palace"]]

    # Opportunity node:
    # 1) 月禄命中本月四宫网络
    # 2) 月科/权命中本月网络
    # 3) 一级/二级共振在本月网络
    # 4) 本月三合中支持星多者
    opportunity=None
    reason=[]
    for typ in ["禄","科","权"]:
        for t in month_trans:
            if t["type"]==typ and t["target_palace"] in network_palaces:
                opportunity=t["target_palace"]
                reason=[f"流月{t['star']}化{typ}命中本月四宫网络"]
                break
        if opportunity: break
    if not opportunity:
        for r in resonances:
            if r["palace"] in network_palaces and r["level"] in {"一级共振","二级共振"}:
                opportunity=r["palace"]; reason=r["evidence"][:2]; break
    if not opportunity:
        candidates=[]
        for p in network["trines"]:
            cond=palace_condition(P.get(p["palace"],{}))
            candidates.append((len(cond["support"]),p["palace"],cond))
        candidates.sort(reverse=True)
        opportunity=candidates[0][1] if candidates else network["core"]
        reason=["本月三合承接节点中支持条件相对更明确"]

    # Bottleneck:
    # 1) 月忌命中网络
    # 2) 本命忌 + 月直接激活/三方
    # 3) 摩擦星/低状态更集中
    bottleneck=None
    breason=[]
    for t in month_trans:
        if t["type"]=="忌" and t["target_palace"] in network_palaces:
            bottleneck=t["target_palace"]
            breason=[f"流月{t['star']}化忌命中本月四宫网络"]
            break
    if not bottleneck:
        natal=natal_transform_hits(chart)
        for p in network_palaces:
            if any(x["type"]=="忌" for x in natal.get(p,[])):
                bottleneck=p
                breason=["本命化忌节点被流月四宫网络重新牵动"]
                break
    if not bottleneck:
        candidates=[]
        for p in network_palaces:
            cond=palace_condition(P.get(p,{}))
            candidates.append((len(cond["friction"])+len(cond["low_state"]),p,cond))
        candidates.sort(reverse=True)
        bottleneck=candidates[0][1]
        breason=["本月四宫网络中摩擦/低适配条件相对集中"]

    return {
        "core_focus":{
            "palace":network["core"],
            "role":network["core_role"],
            "reason":"流月命宫直接落入该宫"
        },
        "opportunity_node":{
            "palace":opportunity,
            "role":PALACE_ROLES[opportunity],
            "reason":reason
        },
        "bottleneck_node":{
            "palace":bottleneck,
            "role":PALACE_ROLES[bottleneck],
            "reason":breason
        },
        "opposite_tension":{
            "palace":network["opposite"]["palace"],
            "role":network["opposite"]["role"],
            "reason":"流月命宫对宫，代表本月需要协调的另一端"
        }
    }

def axis_analysis(chart, req, network, resonances):
    P=chart_by_palace(chart)
    month_nodes={network["core"],*[x["palace"] for x in network["trines"]],network["opposite"]["palace"]}
    month_trans=normalize_transformations(req)
    resonance_map={r["palace"]:r for r in resonances}
    result={}
    for axis,palaces in AXIS.items():
        touched=[p for p in palaces if p in month_nodes]
        trans_hits=[t for t in month_trans if t["target_palace"] in palaces]
        res_hits=[r for p,r in resonance_map.items() if p in palaces and r["level"] in {"一级共振","二级共振"}]
        evidence=[]
        evidence += [f"流月四宫网络包含{p}" for p in touched]
        evidence += [f"{t['layer']} {t['star']}化{t['type']}→{t['target_palace']}" for t in trans_hits]
        evidence += [f"{r['palace']}为{r['level']}" for r in res_hits]
        if trans_hits or res_hits or len(touched)>=2:
            relevance="重点"
        elif touched:
            relevance="辅助"
        else:
            relevance="低"
        if relevance=="低":
            summary="本月不是主要解释轴，不强行扩写。"
        else:
            names="、".join(touched) if touched else "相关宫位"
            summary=f"本月{axis}轴被{name_or(names,'相关节点')}牵动；解释时以这些宫的本命结构为底，再叠加月四化与共振，不用固定剧情。"
        result[axis]={
            "relevance":relevance,
            "touched_palaces":touched,
            "evidence":evidence,
            "summary":summary
        }
    return result

def name_or(x, fallback):
    return x if x else fallback

def monthly_summary(req, network, key_nodes):
    d=req["time_layers"]["decade"]["palace"]
    y=req["time_layers"]["annual"]["palace"]
    m=network["core"]
    return (
        f"在“大限{d}（{PALACE_ROLES[d]}）”的阶段背景下，"
        f"今年重点落在“流年{y}（{PALACE_ROLES[y]}）”；"
        f"本月流月命宫进入{m}，并同时牵动"
        f"{'、'.join(x['palace'] for x in network['trines'])}，对宫为{network['opposite']['palace']}。"
        f"因此本月应优先处理{PALACE_ROLES[m]}，机会承接重点看{key_nodes['opportunity_node']['palace']}，"
        f"而{key_nodes['bottleneck_node']['palace']}是最需要控制成本的节点。"
    )

def actions(key_nodes, axes):
    acts=[]
    core=key_nodes["core_focus"]["palace"]
    opp=key_nodes["opportunity_node"]["palace"]
    bot=key_nodes["bottleneck_node"]["palace"]
    acts.append(f"把本月最重要的决策、时间和注意力优先放在{core}对应的现实事项，而不是平均分配给所有领域。")
    acts.append(f"主动利用{opp}的资源与承接条件，把机会变成可确认、可交付或可沉淀的结果。")
    acts.append(f"遇到{bot}相关事项时先做规则、边界和成本检查，不因为短期机会直接扩大投入。")
    for axis in ["身体","事业","钱","爱情/关系"]:
        if axes[axis]["relevance"]=="重点":
            acts.append(f"{axis}是本月重点轴之一；只围绕已被触发的宫位采取行动，不套用全年固定建议。")
    # dedupe
    return list(dict.fromkeys(acts))

def quality(req, network):
    issues=[]
    for k in ["decade","annual","monthly"]:
        x=req.get("time_layers",{}).get(k)
        if not x or not x.get("palace"):
            issues.append(f"missing_{k}_palace")
        elif not x.get("computed_upstream",False):
            issues.append(f"{k}_not_marked_computed_upstream")
    if network["core"] not in TRINES:
        issues.append("unknown_monthly_palace")
    return {"status":"pass" if not issues else "fail","issues":issues}

def analyze(chart, req):
    monthly=req["time_layers"]["monthly"]["palace"]
    net=monthly_network(monthly)
    reson=resonance(chart,req)
    keys=choose_key_nodes(chart,req,net,reson)
    axes=axis_analysis(chart,req,net,reson)
    out={
        "meta":{
            "engine":"ZDSM Monthly Runtime",
            "version":"1.0",
            "target_month":req.get("target_month"),
            "calendar_label":req.get("calendar_label"),
            "prediction_mode":"trend",
            "ai_api_used":False
        },
        "layer_chain":[
            {"layer":LAYER_ZH[k],"palace":req["time_layers"][k]["palace"],"role":PALACE_ROLES[req["time_layers"][k]["palace"]]}
            for k in LAYER_ORDER if req.get("time_layers",{}).get(k)
        ],
        "monthly_core_network":net,
        "transformations":normalize_transformations(req),
        "resonance_nodes":reson,
        "key_nodes":keys,
        "monthly_summary":monthly_summary(req,net,keys),
        "axes":axes,
        "monthly_actions":actions(keys,axes),
        "quality_gate":quality(req,net)
    }
    return out

if __name__=="__main__":
    if len(sys.argv)!=3:
        print("usage: python monthly_runtime.py chart.json monthly_request.json")
        raise SystemExit(2)
    chart=json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    req=json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
    print(json.dumps(analyze(chart,req),ensure_ascii=False,indent=2))
