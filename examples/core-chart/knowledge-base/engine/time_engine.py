#!/usr/bin/env python3
from pathlib import Path
import json, csv, sys

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"data"
BRANCHES=["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"]

def load_csv(name):
    with open(DATA/name,encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))

PALACE_ORDER=["命宫","兄弟宫","夫妻宫","子女宫","财帛宫","疾厄宫","迁移宫","交友宫","官禄宫","田宅宫","福德宫","父母宫"]

def rotate(seq,start_idx,step=1):
    out=[]
    n=len(seq)
    for i in range(n):
        out.append(seq[(start_idx + i*step)%n])
    return out

def calc_changsheng(bureau, yin_yang_gender):
    starts={r["bureau"]:r["start_branch"] for r in load_csv("changsheng_start.csv")}
    phases=[r["name"] for r in load_csv("changsheng_12.csv")]
    if bureau not in starts:
        return {"status":"not_computed","reason":"unknown_bureau"}
    start=BRANCHES.index(starts[bureau])
    # project source: 阳男阴女顺，阴男阳女逆
    step=1 if yin_yang_gender in {"阳男","阴女"} else -1
    branch_seq=rotate(BRANCHES,start,step)
    return {"status":"computed","mapping":dict(zip(branch_seq,phases))}

def calc_boshi(lucun_branch, yin_yang_gender):
    phases=[r["name"] for r in load_csv("boshi_12.csv")]
    if lucun_branch not in BRANCHES:
        return {"status":"not_computed","reason":"missing_lucun_branch"}
    start=BRANCHES.index(lucun_branch)
    step=1 if yin_yang_gender in {"阳男","阴女"} else -1
    branch_seq=rotate(BRANCHES,start,step)
    return {"status":"computed","mapping":dict(zip(branch_seq,phases))}

def find_palace_by_age(chart, age, field):
    hits=[]
    for p in chart.get("palaces",[]):
        vals=p.get(field,[]) or []
        if age in vals:
            hits.append(p["name"])
    if len(hits)==1:
        return hits[0]
    return None

def decade_for_age(chart, age):
    for p in chart.get("palaces",[]):
        d=p.get("decade")
        if not d: continue
        try:
            a,b=[int(x) for x in d.replace("–","-").split("-")]
            if a<=age<=b:
                return p["name"]
        except Exception:
            pass
    return None

def normalize_layers(chart, request):
    age=request.get("nominal_age")
    layers={}
    if age is not None:
        layers["decade"]={"palace":decade_for_age(chart,age),"source":"chart.age_ranges"}
        layers["annual"]={"palace":find_palace_by_age(chart,age,"annual_ages"),"source":"chart.annual_ages"}
        layers["minor_limit"]={"palace":find_palace_by_age(chart,age,"minor_limit_ages"),"source":"chart.minor_limit_ages"}
    supplied=request.get("time_layers",{})
    for k in ["decade","annual","minor_limit","monthly","daily","hourly"]:
        if supplied.get(k):
            layers[k]=supplied[k]
    return layers

AUTHORITY=["decade","annual","minor_limit","monthly","daily","hourly"]

def make_activation_trace(layers):
    trace=[]
    for idx,name in enumerate(AUTHORITY):
        x=layers.get(name)
        if not x or not x.get("palace"):
            continue
        trace.append({
            "layer":name,
            "palace":x.get("palace"),
            "authority_rank":idx+1,
            "transformations":x.get("transformations",[]),
            "source":x.get("source","upstream")
        })
    return trace

def resonance(trace):
    by_palace={}
    for x in trace:
        by_palace.setdefault(x["palace"],[]).append(x["layer"])
    repeated={p:ls for p,ls in by_palace.items() if len(ls)>=2}
    return repeated

def gate_short_term(trace, context=None):
    long_nodes={x["palace"] for x in trace if x["layer"] in {"decade","annual","minor_limit"}}
    out=[]
    for x in trace:
        if x["layer"] not in {"monthly","daily","hourly"}:
            continue
        same=x["palace"] in long_nodes
        out.append({
            "layer":x["layer"],
            "palace":x["palace"],
            "status":"supported_short_term_signal" if same else "weak_short_term_signal",
            "reason":"matches_upper_layer_node" if same else "does_not_repeat_upper_layer_node"
        })
    return out

def main(chart_path, request_path):
    chart=json.loads(Path(chart_path).read_text(encoding="utf-8"))
    req=json.loads(Path(request_path).read_text(encoding="utf-8"))
    layers=normalize_layers(chart,req)
    trace=make_activation_trace(layers)
    out={
        "time_layers":layers,
        "activation_trace":trace,
        "same_palace_resonance":resonance(trace),
        "short_term_gating":gate_short_term(trace,req.get("context")),
        "policy":{
            "shorter_cycle_has_less_authority":True,
            "monthly_daily_hourly_must_be_supplied_upstream_if_convention_not_locked":True,
            "single_short_cycle_signal_cannot_create_major_event":True
        }
    }
    print(json.dumps(out,ensure_ascii=False,indent=2))

if __name__=="__main__":
    if len(sys.argv)!=3:
        print("usage: python time_engine.py chart.json request.json")
        raise SystemExit(2)
    main(sys.argv[1],sys.argv[2])
