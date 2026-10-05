#!/usr/bin/env python3
from pathlib import Path
import csv, json, subprocess, sys
ROOT=Path(__file__).resolve().parents[1]

def load(name):
    with open(ROOT/"data"/name,encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))

sp=load("star_palace_rules.csv")
assert len(sp)==168, len(sp)
assert len({(r["star_id"],r["palace_id"]) for r in sp})==168

co=load("main_star_colocations.csv")
assert len(co)==24, len(co)

pm=load("main_star_pair_matrix.csv")
assert len(pm)==91, len(pm)
assert sum(r["can_colocate"]=="true" for r in pm)==24

chart=ROOT/"examples"/"example_chart_1997_05_18_full.json"
engine=ROOT/"engine"/"analyze_chart.py"
out=json.loads(subprocess.check_output([sys.executable,str(engine),str(chart)],text=True))
assert len(out["palaces"])==12
by={p["palace"]:p for p in out["palaces"]}
assert by["命宫"]["combination"]["stars"]==["武曲","七杀"]
assert by["官禄宫"]["combination"]["stars"]==["紫微","破军"]
assert by["财帛宫"]["combination"]["stars"]==["廉贞","贪狼"]
assert by["兄弟宫"]["combination"]["stars"]==["天同","天梁"]

print("P1 TEST PASS")
print(json.dumps({
 "star_palace_rules":len(sp),
 "source_explicit":sum(r["source_status"]=="source_explicit" for r in sp),
 "partial_ocr":sum(r["source_status"]=="partial_ocr" for r in sp),
 "model_projection_only":sum(r["source_status"]=="model_projection_only" for r in sp),
 "main_star_colocations":len(co),
 "pair_matrix":len(pm)
},ensure_ascii=False,indent=2))
