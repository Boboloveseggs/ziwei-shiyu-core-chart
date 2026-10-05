#!/usr/bin/env python3
import json, sys
from pathlib import Path

REQUIRED = ["rule_id","rule_type","conditions","effects","evidence","status"]

def validate_rule(rule):
    errors = []
    for k in REQUIRED:
        if k not in rule:
            errors.append(f"missing: {k}")
    ev = rule.get("evidence",{})
    if ev.get("type") not in {"T","S","M","E"}:
        errors.append("evidence.type must be one of T/S/M/E")
    if rule.get("status") not in {"active","experimental","deprecated","rejected"}:
        errors.append("invalid status")
    conf = rule.get("confidence")
    if conf and conf not in {"core","high","medium","low","detail_only"}:
        errors.append("invalid confidence")
    if ev.get("type") == "S" and not ev.get("notes"):
        errors.append("school-specific rule should explain lineage/school in evidence.notes")
    return errors

def main(path):
    p = Path(path)
    data = json.loads(p.read_text(encoding="utf-8"))
    rules = data if isinstance(data, list) else [data]
    total = 0
    bad = 0
    for r in rules:
        total += 1
        errs = validate_rule(r)
        if errs:
            bad += 1
            print(f"[FAIL] {r.get('rule_id','<no id>')}")
            for e in errs: print("  -", e)
        else:
            print(f"[OK] {r['rule_id']}")
    print(f"\nchecked={total}, failed={bad}")
    sys.exit(1 if bad else 0)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: python validate_rules.py <rules.json>")
        sys.exit(2)
    main(sys.argv[1])
