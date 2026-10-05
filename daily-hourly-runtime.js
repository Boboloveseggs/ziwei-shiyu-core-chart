(function () {
  'use strict';

  var bundle = window.ZDSMBundledKnowledge || {};
  var config = bundle.dailyHourlyConfig || {};
  var ROLES = config.palace_roles || {};
  var TRINES = config.trines || {};
  var TM = config.transformations || {};
  var ACTIONS = config.palace_actions || {};
  var CONTEXTS = config.context_rules || {};
  var ORDER = ['decade', 'annual', 'minor_limit', 'monthly', 'daily', 'hourly'];
  var ZH = { decade: '大限', annual: '流年', minor_limit: '小限', monthly: '流月', daily: '流日', hourly: '流时' };
  function layerName(request, layer) {
    return layer === 'decade' && request.time_layers.decade && request.time_layers.decade.childhood ? '童限' : ZH[layer];
  }
  var UPPER = {
    daily: ['decade', 'annual', 'minor_limit', 'monthly'],
    hourly: ['decade', 'annual', 'minor_limit', 'monthly', 'daily'],
  };

  function network(palace) {
    var topology = TRINES[palace];
    if (!topology) throw new Error('排盘器返回了无法识别的短周期宫位：' + (palace || '空值'));
    return {
      core: palace,
      core_role: ROLES[palace],
      trines: topology.trines.map(function (name) { return { palace: name, role: ROLES[name] }; }),
      opposite: { palace: topology.opposite, role: ROLES[topology.opposite] },
      nodes: [palace].concat(topology.trines, [topology.opposite]),
    };
  }

  function natalTransformations(chart) {
    var output = [];
    (chart.palaces || []).forEach(function (palace) {
      (palace.major_stars || []).concat(palace.aux_stars || []).forEach(function (star) {
        var type = String(star.natal_transformation || '').replace('生年', '').replace('化', '');
        if (!TM[type]) return;
        output.push({ layer: '本命', star: star.name, type: type, target_palace: palace.name });
      });
    });
    return output;
  }

  function timedTransformations(request) {
    var output = [];
    ORDER.forEach(function (layer) {
      var item = (request.time_layers || {})[layer];
      if (!item) return;
      (item.transformations || []).forEach(function (transformation) {
        output.push({
          layer: layerName(request, layer), layer_key: layer, star: transformation.star,
          type: transformation.type, target_palace: transformation.target_palace,
        });
      });
    });
    return output;
  }

  function activationMap(request) {
    var result = {};
    ORDER.forEach(function (layer) {
      var item = (request.time_layers || {})[layer];
      if (!item || !item.palace) return;
      if (!result[item.palace]) result[item.palace] = [];
      result[item.palace].push(layerName(request, layer));
    });
    return result;
  }

  function allResonance(chart, request) {
    var activations = activationMap(request);
    var natal = natalTransformations(chart);
    var timed = timedTransformations(request);
    var ranking = { '一级共振': 0, '二级共振': 1, '三级提示': 2 };
    return Object.keys(ROLES).map(function (palace) {
      var evidence = [];
      var independent = new Set();
      (activations[palace] || []).forEach(function (layer) {
        evidence.push(layer + '直接激活');
        independent.add(layer);
      });
      natal.forEach(function (item) {
        if (item.target_palace !== palace) return;
        evidence.push('本命' + item.star + '化' + item.type);
        independent.add('本命四化');
      });
      timed.forEach(function (item) {
        if (item.target_palace !== palace) return;
        evidence.push(item.layer + item.star + '化' + item.type);
        independent.add(item.layer + '四化');
      });
      if (!evidence.length) return null;
      var level = independent.size >= 4 ? '一级共振' : independent.size >= 2 ? '二级共振' : '三级提示';
      return { palace: palace, role: ROLES[palace], level: level, evidence: evidence, independent_layers: independent.size };
    }).filter(Boolean).sort(function (a, b) {
      return ranking[a.level] - ranking[b.level] || b.independent_layers - a.independent_layers || a.palace.localeCompare(b.palace, 'zh-CN');
    });
  }

  function supportStatus(request, layer) {
    var item = (request.time_layers || {})[layer];
    if (!item) return null;
    var currentNetwork = new Set(network(item.palace).nodes);
    var upperNodes = new Set();
    (UPPER[layer] || []).forEach(function (upperLayer) {
      var upper = request.time_layers[upperLayer];
      if (!upper) return;
      upperNodes.add(upper.palace);
      if (upperLayer === 'monthly' || upperLayer === 'daily') {
        network(upper.palace).nodes.forEach(function (palace) { upperNodes.add(palace); });
      }
      (upper.transformations || []).forEach(function (transformation) { upperNodes.add(transformation.target_palace); });
    });
    var overlap = Array.from(currentNetwork).filter(function (palace) { return upperNodes.has(palace); }).sort();
    var status = item.palace && upperNodes.has(item.palace) && overlap.length >= 2 ? 'strong_short_term_signal' :
      overlap.length ? 'supported_short_term_signal' : 'weak_short_term_signal';
    return { layer: ZH[layer], palace: item.palace, status: status, overlap_with_upper: overlap };
  }

  function trajectories(chart, request) {
    var orderIndex = { '本命': 0, '大限': 1, '童限': 1, '流年': 2, '小限': 3, '流月': 4, '流日': 5, '流时': 6 };
    var rows = natalTransformations(chart).concat(timedTransformations(request).map(function (item) {
      return { layer: item.layer, star: item.star, type: item.type, target_palace: item.target_palace };
    }));
    var grouped = rows.reduce(function (result, item) {
      if (!result[item.star]) result[item.star] = [];
      result[item.star].push(item);
      return result;
    }, {});
    return Object.keys(grouped).map(function (star) {
      var items = grouped[star].sort(function (a, b) { return orderIndex[a.layer] - orderIndex[b.layer]; });
      if (items.length < 2) return null;
      var types = items.map(function (item) { return item.type; });
      var pattern;
      var interpretation;
      if (new Set(types).size === 1) {
        pattern = types[0] + '重复';
        interpretation = star + '的同一类机制被多层重复触发，属于持续性而不是单次信号。';
      } else if (types.slice(0, -1).indexOf('忌') !== -1 && ['科', '禄'].indexOf(types[types.length - 1]) !== -1) {
        pattern = '摩擦向整理/资源转化';
        interpretation = star + '呈现先有反复或卡点、后逐步转向整理或可用结果的过程。';
      } else if (['禄', '权'].indexOf(types[0]) !== -1 && types[types.length - 1] === '忌') {
        pattern = '资源/推动后出现成本';
        interpretation = star + '前段有资源或推动，短周期末端成本、占用或反复上升。';
      } else if (types.indexOf('科') !== -1 && types.indexOf('禄') !== -1) {
        pattern = '整理与资源联动';
        interpretation = star + '的整理规范与资源化同时被激活，更适合把复杂事项变成可用成果。';
      } else {
        pattern = '多阶段转换';
        interpretation = star + '在不同时间层承担不同功能，不能做简单吉凶相抵，应按过程顺序解释。';
      }
      return {
        star: star,
        sequence: types.join('→'),
        pattern: pattern,
        steps: items,
        process: items.map(function (item) { return item.layer + '：' + TM[item.type].process + '（' + item.target_palace + '）'; }).join(' → '),
        interpretation: interpretation,
      };
    }).filter(Boolean);
  }

  function bridgeSignals(request) {
    var output = [];
    [['monthly', 'daily'], ['daily', 'hourly']].forEach(function (pair) {
      var source = request.time_layers[pair[0]];
      var target = request.time_layers[pair[1]];
      if (!source || !target) return;
      var targetNetwork = new Set(network(target.palace).nodes);
      (source.transformations || []).forEach(function (transformation) {
        if (!targetNetwork.has(transformation.target_palace)) return;
        output.push({
          from_layer: ZH[pair[0]], to_layer: ZH[pair[1]], star: transformation.star,
          type: transformation.type, target_palace: transformation.target_palace,
          meaning: ZH[pair[0]] + '的' + transformation.star + '化' + transformation.type + '直接落入' + ZH[pair[1]] + '三方四正网络',
        });
      });
    });
    return output;
  }

  function contextAssessment(request, dailyNetwork, hourlyNetwork, resonances) {
    var contextKey = request.event_context || 'general';
    var context = CONTEXTS[contextKey] || CONTEXTS.general;
    var current = hourlyNetwork || dailyNetwork;
    var nodes = new Set(current.nodes);
    var relevance = context.relevant.filter(function (palace) { return nodes.has(palace); });
    var focus = current.core;
    var suitable = (ACTIONS[focus] || []).slice();
    relevance.forEach(function (palace) {
      (ACTIONS[palace] || []).forEach(function (action) { if (suitable.indexOf(action) === -1) suitable.push(action); });
    });
    var risks = [];
    ['daily', 'hourly'].forEach(function (layer) {
      var item = request.time_layers[layer];
      if (!item) return;
      (item.transformations || []).forEach(function (transformation) {
        if (transformation.type === '忌' && nodes.has(transformation.target_palace)) {
          risks.push(ZH[layer] + transformation.star + '化忌落' + transformation.target_palace + '：该环节更容易反复、占用时间或增加成本。');
        }
      });
    });
    resonances.forEach(function (item) {
      if (item.level === '一级共振' && nodes.has(item.palace)) risks.push(item.palace + '为一级共振节点：短时间内更容易成为注意力集中点。');
    });
    var tactics = {
      '田宅宫': '先把沟通或想法结构化，再落成文字、文件、方案或可复用成果。',
      '夫妻宫': '先确认双方目标、责任和条件，再推进承诺。',
      '官禄宫': '先明确结果标准，再推进执行，避免边做边重新定义任务。',
      '子女宫': '先给结论，再给证据；控制临场扩张与无止境解释。',
      '财帛宫': '先确认价格、预算、付款和成本，再决定是否投入。',
    };
    return {
      event_context: contextKey,
      event_label: context.label,
      final_focus_palace: focus,
      final_focus_role: ROLES[focus],
      context_network_overlap: relevance,
      more_suitable_for: suitable.slice(0, 6),
      watch_out_for: Array.from(new Set(risks)).slice(0, 6),
      execution_tactic: tactics[focus] || ('围绕' + focus + '对应事项处理核心任务，并用其三方四正检查资源与牵制。'),
    };
  }

  function buildSummary(request, hourlyNetwork, bridges, paths) {
    var month = request.time_layers.monthly.palace;
    var day = request.time_layers.daily.palace;
    if (!hourlyNetwork) return '本月焦点在' + month + '，当天流日进入' + day + '。日运只负责推进月运已有主题，不单独创造新的长期剧情。';
    var hour = request.time_layers.hourly.palace;
    var text = '本月焦点在' + month + '，当天流日进入' + day + '，当前时段流时进入' + hour + '。';
    if (month === day) text += ' 流月与流日重复命中' + day + '，说明该领域不是单次闪现，而是月度主题在当天被再次推到前台。';
    if (bridges.length) text += ' 日时之间存在四化桥接：' + bridges.slice(0, 2).map(function (item) { return item.meaning; }).join('；') + '。';
    if (paths.length) text += ' 其中' + paths[0].star + '形成“' + paths[0].sequence + '”过程链，应按阶段变化而不是吉凶相抵解释。';
    return text;
  }

  function quality(request) {
    var issues = [];
    ['decade', 'annual', 'monthly', 'daily'].forEach(function (layer) {
      var item = (request.time_layers || {})[layer];
      if (!item || !item.palace) issues.push('missing_' + layer);
      else if (!item.computed_upstream) issues.push(layer + '_not_computed_upstream');
    });
    var hourly = (request.time_layers || {}).hourly;
    if (request.time_window && !hourly) issues.push('time_window_present_but_hourly_missing');
    if (hourly && !hourly.computed_upstream) issues.push('hourly_not_computed_upstream');
    if (hourly && (!hourly.transformations || hourly.transformations.length !== 4)) issues.push('hourly_transformations_incomplete');
    return { status: issues.length ? 'fail' : 'pass', issues: issues };
  }

  function analyze(chart, request) {
    if (!Object.keys(ROLES).length) throw new Error('P6 本地流日/流时配置未载入。');
    var daily = request && request.time_layers && request.time_layers.daily;
    var monthly = request && request.time_layers && request.time_layers.monthly;
    if (!monthly || !monthly.palace) throw new Error('当前排盘模块尚未提供流月位置，无法承接当天分析。');
    if (!monthly.transformations || monthly.transformations.length !== 4) throw new Error('当前排盘模块尚未提供完整的流月四化。');
    if (!daily || !daily.palace) throw new Error('当前排盘模块尚未提供流日位置，无法生成当天分析。');
    if (!daily.transformations || daily.transformations.length !== 4) throw new Error('当前排盘模块尚未提供完整的流日四化。');
    var hourly = request.time_layers.hourly;
    if (request.time_window && (!hourly || !hourly.palace)) throw new Error('已选择时段，但排盘模块尚未提供流时位置。');
    if (hourly && (!hourly.transformations || hourly.transformations.length !== 4)) throw new Error('当前排盘模块尚未提供完整的流时四化。');

    var dailyNetwork = network(daily.palace);
    var hourlyNetwork = hourly ? network(hourly.palace) : null;
    var resonances = allResonance(chart, request);
    var paths = trajectories(chart, request);
    var bridges = bridgeSignals(request);
    var assessment = contextAssessment(request, dailyNetwork, hourlyNetwork, resonances);
    return {
      meta: {
        engine: 'ZDSM Daily/Hourly Runtime', version: '1.0-browser-port',
        target_date: request.target_date, time_window: request.time_window,
        calendar_label: request.calendar_label, event_context: request.event_context || 'general', ai_api_used: false,
      },
      layer_chain: ORDER.filter(function (layer) { return request.time_layers[layer]; }).map(function (layer) {
        var palace = request.time_layers[layer].palace;
        return { layer: layerName(request, layer), palace: palace, role: ROLES[palace] };
      }),
      networks: { monthly: network(request.time_layers.monthly.palace), daily: dailyNetwork, hourly: hourlyNetwork },
      short_term_support: { daily: supportStatus(request, 'daily'), hourly: hourly ? supportStatus(request, 'hourly') : null },
      resonance_nodes: resonances,
      transformation_trajectories: paths,
      bridge_signals: bridges,
      summary: buildSummary(request, hourlyNetwork, bridges, paths),
      window_assessment: assessment,
      quality_gate: quality(request),
    };
  }

  window.ZDSMDailyHourlyRuntime = { version: '1.0-browser-port', analyze: analyze };
}());
