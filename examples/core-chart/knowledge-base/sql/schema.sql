PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sources (
  source_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  source_type TEXT NOT NULL,
  school TEXT,
  citation TEXT NOT NULL,
  edition TEXT,
  page_or_section TEXT,
  raw_excerpt TEXT,
  reliability_note TEXT,
  file_ref TEXT,
  url TEXT
);

CREATE TABLE IF NOT EXISTS stars (
  star_id TEXT PRIMARY KEY,
  core_functions TEXT,
  dysregulation TEXT
);

CREATE TABLE IF NOT EXISTS palaces (
  palace_id TEXT PRIMARY KEY,
  system_role TEXT,
  inputs TEXT,
  outputs TEXT
);

CREATE TABLE IF NOT EXISTS rules (
  rule_id TEXT PRIMARY KEY,
  rule_type TEXT NOT NULL,
  title TEXT,
  conditions_json TEXT NOT NULL,
  effects_json TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  source_ids TEXT,
  confidence TEXT,
  status TEXT NOT NULL,
  falsifiable INTEGER DEFAULT 1,
  observable_indicators TEXT,
  disconfirming_observations TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS topology_edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_palace TEXT NOT NULL,
  to_palace TEXT NOT NULL,
  edge_type TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS temple_states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id TEXT NOT NULL,
  star_id TEXT NOT NULL,
  branch TEXT NOT NULL,
  state TEXT NOT NULL,
  source_id TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS star_interactions (
  interaction_id TEXT PRIMARY KEY,
  star_a TEXT NOT NULL,
  star_b TEXT NOT NULL,
  operator_id TEXT NOT NULL,
  conditions_json TEXT,
  effects_json TEXT NOT NULL,
  source_ids TEXT,
  confidence TEXT,
  status TEXT
);

CREATE TABLE IF NOT EXISTS star_palace_rules (
  rule_id TEXT PRIMARY KEY,
  star_id TEXT NOT NULL,
  palace_id TEXT NOT NULL,
  conditions_json TEXT,
  effects_json TEXT NOT NULL,
  source_ids TEXT,
  confidence TEXT,
  status TEXT
);

CREATE TABLE IF NOT EXISTS transformation_tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id TEXT NOT NULL,
  stem TEXT NOT NULL,
  lu_star TEXT,
  quan_star TEXT,
  ke_star TEXT,
  ji_star TEXT,
  source_id TEXT,
  school TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS validation_records (
  validation_id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  chart_id TEXT,
  analysis_window TEXT,
  prediction_or_claim TEXT,
  observable_indicators TEXT,
  result TEXT NOT NULL,
  notes TEXT,
  recorded_at TEXT
);
