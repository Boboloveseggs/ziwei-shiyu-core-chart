#!/usr/bin/env python3
from pathlib import Path
import json, subprocess, sys, tempfile

ROOT=Path(__file__).resolve().parents[1]
ENGINE=ROOT/"engine"

def main(chart,request,mode="plain"):
    integrated=subprocess.check_output(
        [sys.executable,str(ENGINE/"analyze_with_time.py"),chart,request],text=True
    )
    tmp=Path(tempfile.gettempdir())/"zdsm_integrated.json"
    tmp.write_text(integrated,encoding="utf-8")
    args=[sys.executable,str(ENGINE/"report_compiler.py"),str(tmp),request,"--markdown"]
    if mode=="professional": args.append("--professional")
    return subprocess.check_output(args,text=True)

if __name__=="__main__":
    if len(sys.argv)<3:
        print("usage: python run_pipeline.py chart.json request.json [plain|professional]")
        raise SystemExit(2)
    print(main(sys.argv[1],sys.argv[2],sys.argv[3] if len(sys.argv)>3 else "plain"))
