import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const knowledgeRoot = join(root, 'knowledge-base');
const csvNames = [
  'stars', 'palaces', 'auxiliary_star_functions', 'interaction_operators',
  'star_interactions', 'temple_states', 'transformations', 'source_audit', 'sources',
  'star_palace_rules', 'main_star_colocations', 'main_star_pair_matrix',
  'minor_star_catalog', 'functional_edges', 'changsheng_12', 'boshi_12',
  'taisui_12', 'year_branch_14', 'conclusion_ownership_policy', 'action_library',
];

const csv = Object.fromEntries(csvNames.map((name) => [
  name,
  readFileSync(join(knowledgeRoot, 'data', `${name}.csv`), 'utf8'),
]));
const stages = ['P0', 'P1', 'P2', 'P3', 'P4'].map((name) =>
  JSON.parse(readFileSync(join(knowledgeRoot, `${name}_STATUS.json`), 'utf8')),
);
const manifest = JSON.parse(readFileSync(join(knowledgeRoot, 'manifest.json'), 'utf8'));
const monthlyConfig = JSON.parse(readFileSync(join(knowledgeRoot, 'data', 'monthly_runtime_config.json'), 'utf8'));
const dailyHourlyConfig = JSON.parse(readFileSync(join(knowledgeRoot, 'data', 'daily_hourly_runtime_config.json'), 'utf8'));
const contact = JSON.parse(readFileSync(join(knowledgeRoot, 'config', 'contact.json'), 'utf8'));
const payload = { csv, stages, manifest, monthlyConfig, dailyHourlyConfig, contact };
const output = `/* Generated from knowledge-base; run node build-knowledge-bundle.mjs after CSV updates. */\n` +
  `(function(){'use strict';window.ZDSMBundledKnowledge=${JSON.stringify(payload)};}());\n`;

writeFileSync(join(root, 'knowledge-data.js'), output, 'utf8');
console.log(`knowledge-data.js generated: ${Buffer.byteLength(output)} bytes, ${csvNames.length} CSV tables`);
