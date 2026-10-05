(function () {
  'use strict';

  var VERSION = '1.1.0';
  var PALACES = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '交友', '官禄', '田宅', '福德', '父母'];
  var DIMS = ['drive', 'process', 'output', 'store', 'support', 'friction'];
  var STATE_MULTIPLIER = { '庙': 1.25, '旺': 1.18, '得': 1.10, '利': 1.08, '平': 1, '不': 0.90, '陷': 0.78 };
  var STAR_PROFILES = {
    '紫微': { drive: 1, process: 2.6, output: .8, store: .8, support: 1.2, friction: .4 },
    '天机': { drive: .9, process: 2, output: 1, store: 2, support: .8, friction: .7 },
    '太阳': { drive: 1.2, process: 1.4, output: 1.8, store: .5, support: 1.1, friction: .7 },
    '武曲': { drive: 2.4, process: 1.6, output: .8, store: 1.2, support: .5, friction: .6 },
    '天同': { drive: .5, process: .7, output: .8, store: .8, support: 2, friction: .3 },
    '廉贞': { drive: 1.2, process: 1.3, output: 1.4, store: .5, support: .5, friction: 1.3 },
    '天府': { drive: .7, process: 1.2, output: .6, store: 2.3, support: 1.5, friction: .3 },
    '太阴': { drive: .5, process: .8, output: .7, store: 1.8, support: 1.2, friction: .6 },
    '贪狼': { drive: 1.6, process: 1, output: 2, store: .4, support: .8, friction: 1.2 },
    '巨门': { drive: .8, process: 1.5, output: 2.5, store: .6, support: .5, friction: 1.4 },
    '天相': { drive: .7, process: 1.6, output: .8, store: .8, support: 2.1, friction: .4 },
    '天梁': { drive: .6, process: 1.2, output: .7, store: 1, support: 1.8, friction: .5 },
    '七杀': { drive: 2.5, process: 1.5, output: 1, store: .3, support: .2, friction: 1 },
    '破军': { drive: 1.8, process: 2.5, output: 1.2, store: .2, support: .3, friction: 1.2 },
  };
  var AUX_PROFILES = {
    '左辅': { support: .8 }, '右弼': { support: .8 }, '文昌': { output: .5, store: .4 },
    '文曲': { output: .4, store: .7 }, '天魁': { support: .5 }, '天钺': { support: .5 },
    '禄存': { store: .6, output: .4 }, '天马': { drive: .4, friction: .2 },
    '三台': { store: .25 }, '八座': { support: .25 }, '台辅': { support: .25 },
    '天官': { support: .2 }, '天贵': { support: .2 }, '封诰': { support: .2 },
    '解神': { friction: -.2 }, '红鸾': { output: .2, support: .2 }, '天喜': { support: .2 },
  };
  var MALEFIC_PROFILES = {
    '擎羊': { drive: .4, friction: .9 }, '陀罗': { friction: 1 }, '火星': { drive: .4, friction: .8 },
    '铃星': { output: .2, friction: .8 }, '地空': { friction: .7 }, '天空': { friction: .7 },
    '地劫': { friction: .9 }, '截空': { friction: .6 }, '劫煞': { friction: .6 },
    '天虚': { friction: .5 }, '大耗': { friction: .7 }, '天哭': { friction: .4 },
    '破碎': { friction: .4 }, '孤辰': { friction: .3 }, '天姚': { friction: .2 },
  };
  var PALACE_ROLE = {
    '命宫': 'engine', '官禄': 'processor', '迁移': 'input', '交友': 'input', '父母': 'input',
    '兄弟': 'input', '夫妻': 'input', '子女': 'output', '财帛': 'output', '田宅': 'storage',
    '福德': 'regulation', '疾厄': 'recovery',
  };
  var ROLE_WEIGHT = {
    engine: { drive: 1.65, process: 1.15, output: .8, store: .6, support: .7, friction: 1 },
    processor: { drive: 1.15, process: 1.75, output: 1, store: .8, support: .9, friction: 1 },
    input: { drive: .7, process: .8, output: .7, store: .7, support: 1.65, friction: 1 },
    output: { drive: .8, process: .9, output: 1.75, store: .9, support: .6, friction: 1.15 },
    storage: { drive: .5, process: 1.1, output: .7, store: 1.85, support: .9, friction: .85 },
    regulation: { drive: .9, process: 1.1, output: .6, store: .8, support: .9, friction: 1.35 },
    recovery: { drive: .6, process: .8, output: .5, store: 1, support: 1, friction: 1.35 },
  };
  var TRINES = [['命宫', '财帛', '官禄'], ['兄弟', '田宅', '疾厄'], ['夫妻', '福德', '迁移'], ['子女', '父母', '交友']];
  var OPPOSITES = {
    '命宫': '迁移', '迁移': '命宫', '兄弟': '交友', '交友': '兄弟', '夫妻': '官禄', '官禄': '夫妻',
    '子女': '田宅', '田宅': '子女', '财帛': '福德', '福德': '财帛', '疾厄': '父母', '父母': '疾厄',
  };
  var CONFIG = {
    maxInputs: 3, maxOutputs: 2, maxMainNodes: 8, trineBonus: .16, oppositeBonus: .08,
    bodyDriveBonus: .8, bodyProcessBonus: .9, timingDecadeBonus: .45,
    timingYearBonus: .65, timingSmallLimitBonus: .35,
  };

  function blank() { return { drive: 0, process: 0, output: 0, store: 0, support: 0, friction: 0 }; }
  function add(a, b, multiplier) {
    DIMS.forEach(function (key) { a[key] += ((b || {})[key] || 0) * (multiplier == null ? 1 : multiplier); });
  }
  function clamp(value, minimum, maximum) {
    return Math.max(minimum == null ? 0 : minimum, Math.min(maximum == null ? 5 : maximum, value));
  }
  function sumStrength(score) {
    return clamp(score.drive * .18 + score.process * .22 + score.output * .18 + score.store * .16 + score.support * .14 + score.friction * .12);
  }
  function applyTransform(score, transformation) {
    var type = (transformation || {}).type || '';
    if (type.indexOf('禄') !== -1) { score.output += .55; score.store += .35; }
    if (type.indexOf('权') !== -1) { score.drive += .50; score.process += .45; }
    if (type.indexOf('科') !== -1) { score.process += .35; score.store += .55; }
    if (type.indexOf('忌') !== -1) { score.friction += .85; score.output += .15; }
    if (transformation && transformation.dir === 'out') score.output += .30;
    if (transformation && transformation.dir === 'in') score.process += .20;
  }
  function validateChart(chart) {
    var errors = [];
    if (!chart || typeof chart !== 'object') errors.push('chart 必须是对象');
    if (!chart || !chart.houses) errors.push('缺少 houses');
    PALACES.forEach(function (palace) { if (!chart || !chart.houses || !chart.houses[palace]) errors.push('缺少宫位：' + palace); });
    return { ok: !errors.length, errors: errors };
  }
  function scoreHouse(name, house) {
    var item = house || {};
    var role = item.body ? 'processor' : (PALACE_ROLE[name] || 'input');
    var raw = blank();
    (item.main || []).forEach(function (star) { add(raw, STAR_PROFILES[star.name] || {}, STATE_MULTIPLIER[star.state] || 1); });
    (item.aux || []).forEach(function (star) { add(raw, AUX_PROFILES[star] || {}, 1); });
    (item.malefic || []).forEach(function (star) { add(raw, MALEFIC_PROFILES[star] || {}, 1); });
    (item.transforms || []).forEach(function (transformation) { applyTransform(raw, transformation); });
    if (!(item.main || []).length) { raw.support += .35; raw.process += .20; }
    if (item.body) { raw.drive += CONFIG.bodyDriveBonus; raw.process += CONFIG.bodyProcessBonus; }
    var weights = ROLE_WEIGHT[role];
    var score = blank();
    DIMS.forEach(function (key) { score[key] = clamp(raw[key] * (weights[key] || 1)); });
    return Object.assign({ name: name, role: role }, score, { structuralBonus: 0, activationBonus: 0, strength: sumStrength(score) });
  }
  function applyStructuralCoupling(scores) {
    var byName = Object.fromEntries(scores.map(function (item) { return [item.name, item]; }));
    TRINES.forEach(function (group) {
      var average = group.reduce(function (sum, palace) { return sum + ((byName[palace] || {}).strength || 0); }, 0) / group.length;
      group.forEach(function (palace) { if (byName[palace]) byName[palace].structuralBonus += average * CONFIG.trineBonus; });
    });
    Object.keys(OPPOSITES).forEach(function (source) {
      var target = OPPOSITES[source];
      if (byName[source] && byName[target]) byName[source].structuralBonus += byName[target].strength * CONFIG.oppositeBonus;
    });
    scores.forEach(function (item) { item.strength = clamp(item.strength + item.structuralBonus); });
  }
  function applyTiming(chart, scores) {
    var byName = Object.fromEntries(scores.map(function (item) { return [item.name, item]; }));
    var timing = chart.timing || {};
    function activate(palace, bonus) { if (palace && byName[palace]) byName[palace].activationBonus += bonus; }
    activate((timing.decade || {}).palace, CONFIG.timingDecadeBonus);
    activate((timing.year || {}).palace, CONFIG.timingYearBonus);
    activate((timing.smallLimit || {}).palace, CONFIG.timingSmallLimitBonus);
    scores.forEach(function (item) { item.activatedStrength = clamp(item.strength + item.activationBonus); });
  }
  function top(items, key, number, filter) {
    return items.filter(filter || function () { return true; }).sort(function (a, b) { return b[key] - a[key]; }).slice(0, number == null ? 1 : number);
  }
  function level(value) {
    if (value >= 4) return '很强';
    if (value >= 3) return '强';
    if (value >= 2) return '中等';
    if (value >= 1) return '偏弱';
    return '弱';
  }

  function analyzeChart(chart) {
    var valid = validateChart(chart);
    if (!valid.ok) throw new Error(valid.errors.join('；'));
    var scores = Object.keys(chart.houses).map(function (name) { return scoreHouse(name, chart.houses[name]); });
    applyStructuralCoupling(scores);
    applyTiming(chart, scores);
    var byName = Object.fromEntries(scores.map(function (item) { return [item.name, item]; }));
    var engine = byName['命宫'];
    var processorCandidates = scores.filter(function (item) { return item.name === '官禄' || (chart.houses[item.name] || {}).body; });
    var processor = top(processorCandidates.length ? processorCandidates : scores, 'process', 1)[0];
    var inputs = scores.filter(function (item) { return ['迁移', '交友', '父母', '兄弟', '夫妻'].indexOf(item.name) !== -1; })
      .map(function (item) { return Object.assign({}, item, { inputScore: item.support + item.process * .25 - item.friction * .12 }); })
      .sort(function (a, b) { return b.inputScore - a.inputScore; }).slice(0, CONFIG.maxInputs);
    var outputs = scores.filter(function (item) { return ['子女', '财帛'].indexOf(item.name) !== -1; })
      .map(function (item) { return Object.assign({}, item, { outputScore: item.output - item.friction * .10 }); })
      .sort(function (a, b) { return b.outputScore - a.outputScore; }).slice(0, CONFIG.maxOutputs);
    var storage = byName['田宅'] && byName['田宅'].store >= 1 ? byName['田宅'] : top(scores, 'store', 1)[0];
    var bottleneck = top(scores, 'friction', 1)[0];
    var recovery = ['福德', '疾厄'].map(function (name) { return byName[name]; }).filter(Boolean)
      .map(function (item) { return Object.assign({}, item, { recoveryScore: item.strength + item.friction * .25 }); })
      .sort(function (a, b) { return b.recoveryScore - a.recoveryScore; })[0];
    var mainOutput = outputs[0];
    var secondOutput = outputs[1];
    var visibleNodes = new Set([engine && engine.name, processor && processor.name]
      .concat(inputs.map(function (item) { return item.name; }), outputs.map(function (item) { return item.name; }),
        [storage && storage.name, recovery && recovery.name]).filter(Boolean));
    var edges = [];
    var hiddenEdges = [];
    function pushEdge(source, target, type, label, priority) {
      var edge = { source: source, target: target, type: type, label: label, priority: priority == null ? 1 : priority };
      (visibleNodes.has(source) && visibleNodes.has(target) ? edges : hiddenEdges).push(edge);
    }
    inputs.forEach(function (item) { pushEdge(item.name, processor.name, 'input', '资源输入', 3); });
    pushEdge(engine.name, processor.name, 'engine', '发动', 5);
    if (mainOutput) pushEdge(processor.name, mainOutput.name, 'output', '主要输出', 5);
    if (secondOutput) pushEdge(processor.name, secondOutput.name, 'output', '次级输出', 3);
    if (mainOutput) pushEdge(mainOutput.name, storage.name, 'growth', '沉淀', 5);
    if (secondOutput) pushEdge(secondOutput.name, storage.name, 'growth', '沉淀', 3);
    pushEdge(storage.name, processor.name, 'feedback', '资产反哺', 5);
    pushEdge(processor.name, '福德', 'load', '精神负荷', 4);
    pushEdge('福德', '疾厄', 'recovery', '恢复传导', 4);
    pushEdge('疾厄', engine.name, 'recovery', '恢复反馈', 4);
    pushEdge('交友', '夫妻', 'branch', '人脉转合作', 2);
    pushEdge('财帛', '福德', 'branch', '钱影响价值排序', 2);
    pushEdge('子女', '交友', 'branch', '输出进入社群', 2);
    pushEdge('田宅', '子女', 'feedback', '资产优化输出', 2);
    var growthLoop = [engine.name, processor.name, mainOutput && mainOutput.name, storage.name, processor.name].filter(Boolean);
    var recoveryLoop = [processor.name, '福德', '疾厄', engine.name, processor.name];
    var summary = '该命盘以' + processor.name + '为主要处理核心，能量主要由' +
      [engine.name].concat(inputs.map(function (item) { return item.name; })).slice(0, 4).join('、') + '进入；主要经' +
      (mainOutput ? mainOutput.name : '输出系统') + '向外释放，并在' + storage.name + '形成长期积累。' +
      bottleneck.name + '是摩擦最高节点，长期运行需关注' + recovery.name + '相关的调节与恢复。';
    return {
      version: VERSION, meta: chart.meta || {}, scores: scores, engine: engine, processor: processor,
      inputs: inputs, outputs: outputs, storage: storage, bottleneck: bottleneck, recovery: recovery,
      visibleNodes: Array.from(visibleNodes), edges: edges, hiddenEdges: hiddenEdges,
      growthLoop: growthLoop, recoveryLoop: recoveryLoop, summary: summary,
    };
  }

  window.ZDSMSystemEngine = {
    version: VERSION, analyzeChart: analyzeChart, validateChart: validateChart, level: level,
    profiles: { auxiliary: AUX_PROFILES, malefic: MALEFIC_PROFILES },
  };
}());
