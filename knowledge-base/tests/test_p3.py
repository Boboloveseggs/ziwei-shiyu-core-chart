#!/usr/bin/env python3
from pathlib import Path
import json, subprocess, sys

ROOT=Path(__file__).resolve().parents[1]
ENGINE=ROOT/"engine"
EX=ROOT/"examples"

chart=EX/"example_chart_1997_05_18_full.json"
req=EX/"example_request_2026_10_10_09_11.json"

integrated=json.loads(subprocess.check_output(
    [sys.executable,str(ENGINE/"analyze_with_time.py"),str(chart),str(req)],text=True
))
tmp=EX/"_test_integrated.json"
tmp.write_text(json.dumps(integrated,ensure_ascii=False),encoding="utf-8")

report=json.loads(subprocess.check_output(
    [sys.executable,str(ENGINE/"report_compiler.py"),str(tmp),str(req)],text=True
))
tmp.unlink(missing_ok=True)

assert report["quality_gate"]["status"]=="pass", report["quality_gate"]
assert len(report["distinctive_signatures"])>=3
assert len(report["ending"]["top_3_grabs"])==3
assert len(report["ending"]["top_3_red_lines"])==3
assert len(report["ending"]["top_3_reality_indicators"])==3

families=[x["claim_id"] for x in report["conclusion_ownership"]]
assert len(families)==len(set(families))

actions=[x["action_id"] for x in report["actions"]]
assert len(actions)==len(set(actions))
assert actions.count("A-CONTRACT")==1

for sec in ["身体","事业","钱","爱情/关系",
            "朋友/社群/同行","兄弟姐妹/同辈/团队","父母/亲人/长辈",
            "爱人/伴侣","合作方/客户/上级","晚辈/学生/下属/粉丝/受众"]:
    assert sec in report["sections"]

# Every medium/high full claim has disconfirming conditions
for sec, arr in report["sections"].items():
    for c in arr:
        if c.get("family")=="LOVE-REL-REF": continue
        if c["confidence"] in {"high","medium"}:
            assert c["disconfirming_conditions"], c["claim_id"]

print("P3 TEST PASS")
print(json.dumps({
  "quality_gate":report["quality_gate"],
  "conclusions":len(report["conclusion_ownership"]),
  "actions":len(report["actions"]),
  "distinctive_signatures":len(report["distinctive_signatures"]),
  "validation_objects":len(report["validation_objects"])
},ensure_ascii=False,indent=2))
