#!/usr/bin/env python3
from pathlib import Path
import json, csv, sys

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"data"

def load_csv(name):
    with open(DATA/name,encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))

PALACE_ROLES={r["palace_id"]:r["system_role"] for r in load_csv("palaces.csv")}
TOPO=load_csv("topology_edges.csv")
FUNC=load_csv("functional_edges.csv")

def branch_of(stem_branch):
    return stem_branch[-1] if stem_branch else ""

def tags_for_palace(palace_obj, report):
    tags=[]
    stars=[s["name"] for s in palace_obj.get("major_stars",[])]
    states={s["name"]:s.get("state") for s in palace_obj.get("major_stars",[])}
    aux=[s["name"] for s in palace_obj.get("aux_stars",[])]
    if palace_obj.get("is_body_palace"):
        tags.append("身宫")
    if palace_obj["name"]=="官禄宫" and {"紫微","破军"}.issubset(set(stars)):
        tags += ["中央处理器","重构节点"]
    if palace_obj["name"]=="命宫" and {"武曲","七杀"}.issubset(set(stars)):
        tags += ["发动机","执行节点"]
    if palace_obj["name"]=="财帛宫" and {"廉贞","贪狼"}.issubset(set(stars)):
        tags += ["价值捕获瓶颈"]
    if palace_obj["name"]=="田宅宫" and "天机" in stars:
        tags += ["长期资产节点"]
    if palace_obj["name"]=="子女宫" and "巨门" in stars:
        tags += ["输出接口","反馈摩擦节点"]
    if palace_obj["name"]=="疾厄宫":
        tags += ["恢复节点"]
    # Derive claim tags from report ownership/evidence
    refs=[]
    for c in report.get("conclusion_ownership",[]):
        cid=c["claim_id"]
        for sec in report.get("sections",{}).values():
            for full in sec:
                if full.get("claim_id")==cid:
                    if any(e.get("palace")==palace_obj["name"] for e in full.get("evidence_trace",[])):
                        refs.append(cid)
    return list(dict.fromkeys(tags)), list(dict.fromkeys(refs))

def build(chart, report):
    active={}
    for x in report.get("annual_causal_chain",{}).get("layers",[]):
        active.setdefault(x["palace"],[]).append(x["layer"])

    nodes=[]
    for p in chart["palaces"]:
        tags,refs=tags_for_palace(p,report)
        nodes.append({
            "id":p["name"],
            "palace":p["name"],
            "branch":branch_of(p.get("stem_branch","")),
            "stem_branch":p.get("stem_branch",""),
            "role":PALACE_ROLES.get(p["name"],""),
            "stars":p.get("major_stars",[]),
            "aux_stars":p.get("aux_stars",[]),
            "system_tags":tags,
            "activation_layers":active.get(p["name"],[]),
            "claim_refs":refs
        })

    edges=[]
    for r in TOPO:
        edges.append({
            "source":r["from_palace"],"target":r["to_palace"],
            "edge_type":r["edge_type"],
            "label":"三合" if r["edge_type"]=="trine" else "对宫",
            "layers":["natal"],"evidence_type":"T"
        })
    for r in FUNC:
        edges.append({
            "source":r["source"],"target":r["target"],
            "edge_type":"functional","label":r["label"],
            "layers":["natal"],"evidence_type":"M"
        })

    # Natal transformation/self-transform annotations as loop/flow edges when direction is explicit.
    for p in chart["palaces"]:
        for s in p.get("major_stars",[]):
            sf=s.get("self_transform")
            if sf:
                edges.append({
                    "source":p["name"],"target":p["name"],
                    "edge_type":"self_transform",
                    "label":f"{s['name']} {sf}",
                    "layers":["natal"],"evidence_type":"S"
                })

    # Time transformation edges: target only; source is layer node conceptually.
    # Represent as synthetic source nodes only in metadata, not as palace nodes.
    time_flows=[]
    for layer in report.get("annual_causal_chain",{}).get("layers",[]):
        pass
    return {
        "meta":{
            "engine":"ZDSM","version":"1.5-P4-local",
            "profile":chart.get("profile",{}),
            "principle":"每张命盘都是十二宫节点 + 传统拓扑 + 功能边 + 四化/自化 + 时间激活构成的个体系统图"
        },
        "nodes":nodes,
        "edges":edges,
        "active_layers":active,
        "legend":{
            "node_tags":{
                "发动机":"核心行动与决策来源",
                "中央处理器":"统筹、职业与高阶重构节点",
                "价值捕获瓶颈":"价值交换/留存需要重点优化",
                "长期资产节点":"知识、作品、流程、存量资产",
                "输出接口":"作品、表达、教学、受众",
                "恢复节点":"负荷与恢复"
            },
            "edge_types":{
                "trine":"传统三合",
                "opposite":"传统对宫",
                "functional":"ZDSM现代功能链",
                "self_transform":"流派特定自化"
            }
        }
    }

if __name__=="__main__":
    if len(sys.argv)!=4:
        print("usage: python system_graph.py chart.json compiled_report.json output.json")
        raise SystemExit(2)
    chart=json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    report=json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
    out=build(chart,report)
    Path(sys.argv[3]).write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding="utf-8")
    print(Path(sys.argv[3]))
