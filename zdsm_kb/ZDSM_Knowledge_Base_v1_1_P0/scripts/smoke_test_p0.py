#!/usr/bin/env python3
import csv, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def load(name):
    with open(ROOT/"data"/name,encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))

temple=load("temple_states.csv")
main=[r for r in temple if r["table_id"]=="QUANSHU_MAIN_14_V1"]
assert len(main)==168, len(main)
assert all(r["state"]!="未定" for r in main)

sihua=load("transformation_tables.csv")
for tid in {"PROJECT_BOOK_V1","QUANJI_COMMON_V1","QUANSHU_COMPARE_V1"}:
    rows=[r for r in sihua if r["table_id"]==tid]
    assert len(rows)==10,(tid,len(rows))

ints=load("star_interactions.csv")
assert len(ints)>=20

print("P0 smoke test PASS")
print(json.dumps({
  "main_temple_rows":len(main),
  "sihua_rows":len(sihua),
  "interaction_rows":len(ints)
},ensure_ascii=False,indent=2))
