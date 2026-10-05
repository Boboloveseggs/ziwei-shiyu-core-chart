#!/usr/bin/env python3
from pathlib import Path
import subprocess, sys, json, tempfile, shutil

ROOT=Path(__file__).resolve().parents[1]
ENGINE=ROOT/"engine"
CONTACT=ROOT/"config"/"contact.json"

def run(cmd):
    return subprocess.check_output(cmd,text=True)

if __name__=="__main__":
    if len(sys.argv)<4:
        print("usage: python full_local_pipeline.py chart.json request.json output_dir")
        raise SystemExit(2)

    chart=Path(sys.argv[1]).resolve()
    req=Path(sys.argv[2]).resolve()
    out=Path(sys.argv[3]).resolve()
    out.mkdir(parents=True,exist_ok=True)

    integrated=run([sys.executable,str(ENGINE/"analyze_with_time.py"),str(chart),str(req)])
    integrated_path=out/"integrated.json"
    integrated_path.write_text(integrated,encoding="utf-8")

    report=run([sys.executable,str(ENGINE/"report_compiler.py"),str(integrated_path),str(req)])
    report_path=out/"report.json"
    report_path.write_text(report,encoding="utf-8")

    report_md=run([sys.executable,str(ENGINE/"report_compiler.py"),str(integrated_path),str(req),"--professional"])
    (out/"report.md").write_text(report_md,encoding="utf-8")

    run([sys.executable,str(ENGINE/"system_graph.py"),str(chart),str(report_path),str(out/"system_map.json")])
    run([sys.executable,str(ENGINE/"render_system_map.py"),str(out/"system_map.json"),str(CONTACT),str(out/"system_map.html")])

    print(json.dumps({
      "status":"ok",
      "ai_api_used":False,
      "outputs":{
        "report_json":str(out/"report.json"),
        "report_markdown":str(out/"report.md"),
        "system_map_json":str(out/"system_map.json"),
        "system_map_html":str(out/"system_map.html")
      }
    },ensure_ascii=False,indent=2))
