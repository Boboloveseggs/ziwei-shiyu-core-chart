#!/usr/bin/env python3
from pathlib import Path
import csv, json, sys, itertools

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"data"

def load_csv(name):
    with open(DATA/name,encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))

SP={(r["star_id"],r["palace_id"]):r for r in load_csv("star_palace_rules.csv")}
CO={}
for r in load_csv("main_star_colocations.csv"):
    CO[tuple(sorted((r["star_a"],r["star_b"])))] = r
AUX={r["star_id"]:r for r in load_csv("auxiliary_star_functions.csv")}
TRANS={r["transformation"]:r for r in load_csv("transformations.csv")}

STATE_EFFECT={
    "庙":"核心功能表达充分，通常更容易稳定发挥，但仍需看三方与煞曜。",
    "旺":"核心功能表达较强，容易成为该领域的显著机制。",
    "得地":"功能与位置较适配，通常可较顺地发挥。",
    "利":"功能有可用性，但仍需要组合条件支持。",
    "平":"功能可表达，但优势/摩擦更依赖组合和时间层。",
    "不得地":"适配度偏低，需要更多外部条件与自我调节。",
    "陷":"控制成本较高；不等于功能不存在，而是更容易出现失调或高代价表达。",
    "未定":"当前资料库不使用庙旺门控。",
    "不":"状态来源缩写未标准化，暂不据此扩展结论。",
}

def analyze_chart(chart):
    result={"profile":chart.get("profile",{}),"palaces":[],"warnings":[]}
    for p in chart.get("palaces",[]):
        pname=p["name"]
        major=p.get("major_stars",[])
        item={"palace":pname,"major_star_rules":[],"combination":None,"auxiliary":[],"transformations":[]}
        for s in major:
            name=s["name"]
            r=SP.get((name,pname))
            if not r:
                result["warnings"].append(f"missing star-palace rule: {name}/{pname}")
                continue
            item["major_star_rules"].append({
                "star":name,
                "state":s.get("state"),
                "state_effect":STATE_EFFECT.get(s.get("state"),""),
                "core_effect":r["modern_core_effect"],
                "possible_manifestations":json.loads(r["possible_manifestations_json"]),
                "risk_pattern":r["risk_pattern"],
                "source_status":r["source_status"],
                "confidence":r["confidence"],
            })
            if s.get("natal_transformation"):
                tr=s["natal_transformation"].replace("生年","").replace("化","")
                if tr in TRANS:
                    item["transformations"].append({
                        "star":name,"layer":"natal","type":tr,
                        "meaning":TRANS[tr]["meanings"],
                    })
            if s.get("self_transform"):
                item["transformations"].append({
                    "star":name,"layer":"school_specific_self_transform","type":s["self_transform"],
                    "warning":"仅按上游排盘器提供的自化符号解释，不在本引擎内重新计算。"
                })
        if len(major)>=2:
            for a,b in itertools.combinations([s["name"] for s in major],2):
                c=CO.get(tuple(sorted((a,b))))
                if c:
                    item["combination"]={
                        "stars":[a,b],
                        "operator":c["operator_id"],
                        "effect":c["modern_effect"],
                        "confidence":c["confidence"]
                    }
        for s in p.get("aux_stars",[]):
            ar=AUX.get(s["name"])
            if ar:
                item["auxiliary"].append({
                    "star":s["name"],
                    "operator":ar["default_operator"],
                    "function":ar["modern_functions"],
                    "state":s.get("state")
                })
        result["palaces"].append(item)
    return result

def render_plain(result):
    lines=[]
    for p in result["palaces"]:
        if not p["major_star_rules"]:
            continue
        lines.append(f"## {p['palace']}")
        for r in p["major_star_rules"]:
            lines.append(f"- {r['star']}：{r['core_effect']}")
            if r["state_effect"]:
                lines.append(f"  状态：{r['state_effect']}")
        if p["combination"]:
            c=p["combination"]
            lines.append(f"- 同宫组合（{c['operator']}）：{c['effect']}")
        if p["auxiliary"]:
            aux="；".join(f"{x['star']}→{x['operator']}({x['function']})" for x in p["auxiliary"])
            lines.append(f"- 辅煞：{aux}")
        if p["transformations"]:
            for t in p["transformations"]:
                if "meaning" in t:
                    lines.append(f"- {t['star']}生年{t['type']}：{t['meaning']}")
                else:
                    lines.append(f"- {t['star']}自化：{t['type']}（流派特定层）")
        lines.append("")
    return "\n".join(lines)

if __name__=="__main__":
    if len(sys.argv)<2:
        print("usage: python analyze_chart.py chart.json [--plain]")
        raise SystemExit(2)
    chart=json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    out=analyze_chart(chart)
    if "--plain" in sys.argv:
        print(render_plain(out))
    else:
        print(json.dumps(out,ensure_ascii=False,indent=2))
