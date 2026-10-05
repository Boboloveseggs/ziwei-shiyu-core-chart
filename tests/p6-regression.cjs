const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function loadJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

global.window = {};
vm.runInThisContext(fs.readFileSync(path.join(root, 'knowledge-data.js'), 'utf8'), { filename: 'knowledge-data.js' });
vm.runInThisContext(fs.readFileSync(path.join(root, 'daily-hourly-runtime.js'), 'utf8'), { filename: 'daily-hourly-runtime.js' });

const chart = loadJson('knowledge-base/examples/p6-daily-hourly/example_chart.json');
const request = loadJson('knowledge-base/examples/p6-daily-hourly/example_request_2026_10_10_09_11.json');
const result = window.ZDSMDailyHourlyRuntime.analyze(chart, request);

assert(result.meta.ai_api_used === false, 'P6 不得使用 AI API');
assert(result.quality_gate.status === 'pass', `P6 质量门失败：${result.quality_gate.issues.join(', ')}`);

const expectedChain = [
  ['大限', '福德宫'],
  ['流年', '子女宫'],
  ['小限', '交友宫'],
  ['流月', '夫妻宫'],
  ['流日', '夫妻宫'],
  ['流时', '田宅宫'],
];
assert(JSON.stringify(result.layer_chain.map((item) => [item.layer, item.palace])) === JSON.stringify(expectedChain), '六层落宫与指定回归样例不一致');

assert(result.networks.monthly.core === '夫妻宫', '流月核心宫应为夫妻宫');
assert(result.networks.daily.core === '夫妻宫', '流日核心宫应为夫妻宫');
assert(result.networks.hourly.core === '田宅宫', '流时核心宫应为田宅宫');
['monthly', 'daily', 'hourly'].forEach((layer) => {
  assert(result.networks[layer].nodes.length === 4, `${layer} 未独立计算完整三方四正`);
});

const repeated = result.resonance_nodes.find((item) => item.palace === '夫妻宫');
assert(repeated && repeated.evidence.includes('流月直接激活') && repeated.evidence.includes('流日直接激活'), '未识别月／日夫妻宫重复激活');

const dayHourBridges = result.bridge_signals.filter((item) => item.from_layer === '流日' && item.to_layer === '流时');
assert(dayHourBridges.some((item) => item.target_palace === '田宅宫'), '日→时桥接缺少田宅宫');
assert(dayHourBridges.some((item) => item.target_palace === '子女宫'), '日→时桥接缺少子女宫');

const tianji = result.transformation_trajectories.find((item) => item.star === '天机');
assert(tianji, '未生成天机跨层四化过程链');
assert(tianji.sequence === '科→忌→科→禄', `天机过程链错误：${tianji.sequence}`);
assert(['本命', '流月', '流日', '流时'].every((layer) => tianji.steps.some((step) => step.layer === layer)), '天机过程链缺少本命／月／日／时层');

const assessment = result.window_assessment;
assert(assessment.final_focus_palace === '田宅宫', '最终时段焦点应为田宅宫');
['写文档', '整理方案', '归档知识', '把沟通结果落成长期资产'].forEach((action) => {
  assert(assessment.more_suitable_for.includes(action), `田宅行动缺少：${action}`);
});
assert(/结构化/.test(assessment.execution_tactic) && /文字|文件|方案|成果/.test(assessment.execution_tactic), '执行策略没有体现结构化与成果沉淀');
assert(!/吉时|凶时|黄道/.test(JSON.stringify(assessment)), '行动结论不得使用固定吉时模板');

const contact = window.ZDSMBundledKnowledge.contact;
assert(contact.mode === 'human_only' && contact.ai_api_enabled === false, '底部联系配置必须保持纯人工咨询');

console.log(JSON.stringify({
  status: 'pass',
  layerChain: result.layer_chain.map((item) => `${item.layer}${item.palace}`),
  networks: {
    monthly: result.networks.monthly.nodes,
    daily: result.networks.daily.nodes,
    hourly: result.networks.hourly.nodes,
  },
  repeatedActivation: repeated.palace,
  dayHourBridgeTargets: dayHourBridges.map((item) => item.target_palace),
  tianjiSequence: tianji.sequence,
  finalFocus: assessment.final_focus_palace,
  suitableFor: assessment.more_suitable_for,
  aiApiUsed: result.meta.ai_api_used,
}));
