#!/usr/bin/env python3
from pathlib import Path
import json, subprocess, sys

ROOT=Path(__file__).resolve().parents[1]
ENGINE=ROOT/"engine"

def run_json(cmd):
    return json.loads(subprocess.check_output(cmd,text=True))

if __name__=="__main__":
    if len(sys.argv)!=3:
        print("usage: python analyze_with_time.py chart.json request.json")
        raise SystemExit(2)
    chart,req=sys.argv[1],sys.argv[2]
    natal=run_json([sys.executable,str(ENGINE/"analyze_chart.py"),chart])
    timed=run_json([sys.executable,str(ENGINE/"time_engine.py"),chart,req])
    out={
      "natal":natal,
      "time":timed,
      "next_step":"report_renderer_should_assign_conclusion_ownership_before prose generation"
    }
    print(json.dumps(out,ensure_ascii=False,indent=2))
