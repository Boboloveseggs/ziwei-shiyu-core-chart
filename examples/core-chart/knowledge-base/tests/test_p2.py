#!/usr/bin/env python3
from pathlib import Path
import csv,json,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
def load(name):
    with open(ROOT/"data"/name,encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))

assert len(load("changsheng_12.csv"))==12
assert len(load("boshi_12.csv"))==12
assert len(load("year_branch_14.csv"))==14
assert len(load("minor_star_catalog.csv"))>=20

chart=ROOT/"examples"/"example_chart_1997_05_18_full.json"
req=ROOT/"examples"/"example_request_2026_10_10_09_11.json"
engine=ROOT/"engine"/"time_engine.py"
out=json.loads(subprocess.check_output([sys.executable,str(engine),str(chart),str(req)],text=True))
assert out["time_layers"]["decade"]["palace"]=="福德宫"
assert out["time_layers"]["annual"]["palace"]=="子女宫"
assert out["time_layers"]["minor_limit"]["palace"]=="交友宫"
assert out["time_layers"]["monthly"]["palace"]=="夫妻宫"
assert out["time_layers"]["daily"]["palace"]=="夫妻宫"
assert out["time_layers"]["hourly"]["palace"]=="田宅宫"
assert "夫妻宫" in out["same_palace_resonance"]

print("P2 TEST PASS")
print(json.dumps({
 "decade":out["time_layers"]["decade"]["palace"],
 "annual":out["time_layers"]["annual"]["palace"],
 "minor_limit":out["time_layers"]["minor_limit"]["palace"],
 "monthly":out["time_layers"]["monthly"]["palace"],
 "daily":out["time_layers"]["daily"]["palace"],
 "hourly":out["time_layers"]["hourly"]["palace"],
 "resonance":out["same_palace_resonance"]
},ensure_ascii=False,indent=2))
