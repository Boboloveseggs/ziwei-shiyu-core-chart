#!/usr/bin/env python3
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "data" / "zdsm.sqlite"
SQL = (ROOT / "sql" / "schema.sql").read_text(encoding="utf-8")

con = sqlite3.connect(DB)
con.executescript(SQL)
con.commit()
con.close()
print(DB)
