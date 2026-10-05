#!/usr/bin/env python3
from pathlib import Path
import json, subprocess, sys, shutil
ROOT=Path(__file__).resolve().parents[1]
ENGINE=ROOT/"engine"
EX=ROOT/"examples"
CFG=ROOT/"config"/"contact.json"

contact=json.loads(CFG.read_text(encoding="utf-8"))
assert contact["ai_api_enabled"] is False
assert contact["mode"]=="human_only"

graph=json.loads((EX/"example_system_map_1997_05_18.json").read_text(encoding="utf-8"))
assert len(graph["nodes"])==12
assert any("发动机" in n["system_tags"] for n in graph["nodes"] if n["palace"]=="命宫")
assert any("中央处理器" in n["system_tags"] for n in graph["nodes"] if n["palace"]=="官禄宫")
assert any("价值捕获瓶颈" in n["system_tags"] for n in graph["nodes"] if n["palace"]=="财帛宫")
assert any(e["edge_type"]=="functional" for e in graph["edges"])
assert any(e["edge_type"]=="trine" for e in graph["edges"])
assert any(e["edge_type"]=="opposite" for e in graph["edges"])

html=(EX/"example_system_map_1997_05_18.html").read_text(encoding="utf-8")
assert "ZDSM 十二宫系统图" in html
assert "联系人工解读" in html

out=EX/"_pipeline_test"
if out.exists(): shutil.rmtree(out)
payload=json.loads(subprocess.check_output([
    sys.executable,str(ENGINE/"full_local_pipeline.py"),
    str(EX/"example_chart_1997_05_18_full.json"),
    str(EX/"example_request_2026_10_10_09_11.json"),
    str(out)
],text=True))
assert payload["ai_api_used"] is False
for f in ["report.json","report.md","system_map.json","system_map.html"]:
    assert (out/f).exists(),f
shutil.rmtree(out)

print("P4 LOCAL TEST PASS")
print(json.dumps({
  "ai_api_used":False,
  "nodes":len(graph["nodes"]),
  "edges":len(graph["edges"]),
  "human_contact_only":True
},ensure_ascii=False,indent=2))
