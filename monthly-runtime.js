(function () {
  'use strict';

  var bundle = window.ZDSMBundledKnowledge || {};
  var config = bundle.monthlyConfig || {};
  var PALACE_ROLES = config.palace_roles || {};
  var TRINES = config.trines || {};
  var TRANS = config.transform_meanings || {};
  var AXIS = config.axis_palaces || {};
  var LAYER_ZH = { decade: '大限', annual: '流年', minor_limit: '小限', monthly: '流月' };
  var LAYER_ORDER = ['decade', 'annual', 'minor_limit', 'monthly'];

  function layerName(request, layer) {
    return layer === 'decade' && request.time_layers.decade && request.time_layers.decade.childhood ? '童限' : LAYER_ZH[layer];
  }

  function chartByPalace(chart) {
    return (chart.palaces || []).reduce(function (result, palace) {
      result[palace.name] = palace;
      return result;
    }, {});
  }

  function normalizeTransformations(request) {
    var output = [];
    LAYER_ORDER.forEach(function (layer) {
      var item = (request.time_layers || {})[layer] || {};
      (item.transformations || []).forEach(function (transformation) {
        output.push({
          layer: layerName(request, layer),
          star: transformation.star,
          type: transformation.type,
          target_palace: transformation.target_palace,
          meaning: TRANS[transformation.type],
        });
      });
    });
    return output;
  }

  function monthlyNetwork(monthlyPalace) {
    var topology = TRINES[monthlyPalace];
    if (!topology) throw new Error('排盘器返回了无法识别的流月宫位：' + (monthlyPalace || '空值'));
    return {
      core: monthlyPalace,
      core_role: PALACE_ROLES[monthlyPalace],
      trines: topology.trines.map(function (palace) {
        return { palace: palace, role: PALACE_ROLES[palace] };
      }),
      opposite: { palace: topology.opposite, role: PALACE_ROLES[topology.opposite] },
      interpretation_rule: '流月命宫是本月注意力与事件入口；三合宫提供同一事件系统的资源/承接；对宫体现拉扯、外部要求或需要协调的另一端。',
    };
  }

  function activationLayers(request) {
    var output = {};
    LAYER_ORDER.forEach(function (layer) {
      var item = (request.time_layers || {})[layer];
      if (!item || !item.palace) return;
      if (!output[item.palace]) output[item.palace] = [];
      output[item.palace].push(layerName(request, layer));
    });
    return output;
  }

  function transformationHits(request) {
    return normalizeTransformations(request).reduce(function (result, item) {
      if (!result[item.target_palace]) result[item.target_palace] = [];
      result[item.target_palace].push(item);
      return result;
    }, {});
  }

  function natalTransformHits(chart) {
    var hits = {};
    (chart.palaces || []).forEach(function (palace) {
      (palace.major_stars || []).concat(palace.aux_stars || []).forEach(function (star) {
        var type = String(star.natal_transformation || '').replace('生年', '').replace('化', '');
        if (!TRANS[type]) return;
        if (!hits[palace.name]) hits[palace.name] = [];
        hits[palace.name].push({
          layer: '本命', star: star.name, type: type,
          target_palace: palace.name, meaning: TRANS[type],
        });
      });
    });
    return hits;
  }

  function palaceCondition(palace) {
    var support = [];
    var friction = [];
    var lowState = [];
    var highState = [];
    var supportNames = ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺', '禄存', '解神', '恩光', '天贵', '三台', '八座'];
    var frictionNames = ['擎羊', '陀罗', '火星', '铃星', '天空', '地空', '地劫', '截空', '破碎', '天哭', '天虚'];
    (palace.major_stars || []).forEach(function (star) {
      if (['庙', '旺', '得地', '利', '得'].indexOf(star.state) !== -1) highState.push(star.name + '(' + star.state + ')');
      if (['陷', '不得地', '不'].indexOf(star.state) !== -1) lowState.push(star.name + '(' + star.state + ')');
    });
    (palace.aux_stars || []).forEach(function (star) {
      if (supportNames.indexOf(star.name) !== -1) support.push(star.name);
      if (frictionNames.indexOf(star.name) !== -1) friction.push(star.name);
    });
    return { support: support, friction: friction, high_state: highState, low_state: lowState };
  }

  function resonance(chart, request) {
    var activations = activationLayers(request);
    var transformations = transformationHits(request);
    var natal = natalTransformHits(chart);
    var order = { '一级共振': 0, '二级共振': 1, '三级提示': 2 };
    return Object.keys(PALACE_ROLES).map(function (palace) {
      var layers = activations[palace] || [];
      var trans = transformations[palace] || [];
      var natalTrans = natal[palace] || [];
      var evidence = layers.map(function (layer) { return layer + '直接激活'; })
        .concat(trans.map(function (item) { return item.layer + ' ' + item.star + '化' + item.type; }))
        .concat(natalTrans.map(function (item) { return '本命 ' + item.star + '化' + item.type; }));
      var independent = new Set(layers);
      if (trans.length) independent.add('四化');
      if (natalTrans.length) independent.add('本命四化');
      if (!evidence.length) return null;
      var level = independent.size >= 3 ? '一级共振' : independent.size === 2 ? '二级共振' : '三级提示';
      return { palace: palace, role: PALACE_ROLES[palace], level: level, evidence: evidence };
    }).filter(Boolean).sort(function (a, b) {
      return order[a.level] - order[b.level] || a.palace.localeCompare(b.palace, 'zh-CN');
    });
  }

  function chooseKeyNodes(chart, request, network, resonances) {
    var palaces = chartByPalace(chart);
    var monthTrans = request.time_layers.monthly.transformations || [];
    var networkPalaces = [network.core].concat(network.trines.map(function (item) { return item.palace; }), [network.opposite.palace]);
    var opportunity = null;
    var opportunityReason = [];
    ['禄', '科', '权'].some(function (type) {
      return monthTrans.some(function (item) {
        if (item.type !== type || networkPalaces.indexOf(item.target_palace) === -1) return false;
        opportunity = item.target_palace;
        opportunityReason = ['流月' + item.star + '化' + type + '命中本月四宫网络'];
        return true;
      });
    });
    if (!opportunity) {
      var resonanceHit = resonances.find(function (item) {
        return networkPalaces.indexOf(item.palace) !== -1 && ['一级共振', '二级共振'].indexOf(item.level) !== -1;
      });
      if (resonanceHit) {
        opportunity = resonanceHit.palace;
        opportunityReason = resonanceHit.evidence.slice(0, 2);
      }
    }
    if (!opportunity) {
      var candidates = network.trines.map(function (item) {
        var condition = palaceCondition(palaces[item.palace] || {});
        return { palace: item.palace, score: condition.support.length };
      }).sort(function (a, b) { return b.score - a.score || b.palace.localeCompare(a.palace, 'zh-CN'); });
      opportunity = candidates.length ? candidates[0].palace : network.core;
      opportunityReason = ['本月三合承接节点中支持条件相对更明确'];
    }

    var bottleneck = null;
    var bottleneckReason = [];
    monthTrans.some(function (item) {
      if (item.type !== '忌' || networkPalaces.indexOf(item.target_palace) === -1) return false;
      bottleneck = item.target_palace;
      bottleneckReason = ['流月' + item.star + '化忌命中本月四宫网络'];
      return true;
    });
    if (!bottleneck) {
      var natal = natalTransformHits(chart);
      networkPalaces.some(function (palace) {
        if (!(natal[palace] || []).some(function (item) { return item.type === '忌'; })) return false;
        bottleneck = palace;
        bottleneckReason = ['本命化忌节点被流月四宫网络重新牵动'];
        return true;
      });
    }
    if (!bottleneck) {
      var frictionCandidates = networkPalaces.map(function (palace) {
        var condition = palaceCondition(palaces[palace] || {});
        return { palace: palace, score: condition.friction.length + condition.low_state.length };
      }).sort(function (a, b) { return b.score - a.score || b.palace.localeCompare(a.palace, 'zh-CN'); });
      bottleneck = frictionCandidates[0].palace;
      bottleneckReason = ['本月四宫网络中摩擦/低适配条件相对集中'];
    }

    return {
      core_focus: { palace: network.core, role: network.core_role, reason: '流月命宫直接落入该宫' },
      opportunity_node: { palace: opportunity, role: PALACE_ROLES[opportunity], reason: opportunityReason },
      bottleneck_node: { palace: bottleneck, role: PALACE_ROLES[bottleneck], reason: bottleneckReason },
      opposite_tension: {
        palace: network.opposite.palace,
        role: network.opposite.role,
        reason: '流月命宫对宫，代表本月需要协调的另一端',
      },
    };
  }

  function axisAnalysis(request, network, resonances) {
    var monthNodes = new Set([network.core].concat(network.trines.map(function (item) { return item.palace; }), [network.opposite.palace]));
    var transformations = normalizeTransformations(request);
    var resonanceMap = resonances.reduce(function (result, item) { result[item.palace] = item; return result; }, {});
    return Object.keys(AXIS).reduce(function (result, axis) {
      var palaces = AXIS[axis];
      var touched = palaces.filter(function (palace) { return monthNodes.has(palace); });
      var transHits = transformations.filter(function (item) { return palaces.indexOf(item.target_palace) !== -1; });
      var resonanceHits = palaces.map(function (palace) { return resonanceMap[palace]; }).filter(function (item) {
        return item && ['一级共振', '二级共振'].indexOf(item.level) !== -1;
      });
      var evidence = touched.map(function (palace) { return '流月四宫网络包含' + palace; })
        .concat(transHits.map(function (item) { return item.layer + ' ' + item.star + '化' + item.type + '→' + item.target_palace; }))
        .concat(resonanceHits.map(function (item) { return item.palace + '为' + item.level; }));
      var relevance = transHits.length || resonanceHits.length || touched.length >= 2 ? '重点' : touched.length ? '辅助' : '低';
      result[axis] = {
        relevance: relevance,
        touched_palaces: touched,
        evidence: evidence,
        summary: relevance === '低' ? '本月不是主要解释轴，不强行扩写。' :
          '本月' + axis + '轴被' + (touched.join('、') || '相关节点') + '牵动；解释时以这些宫的本命结构为底，再叠加月四化与共振，不用固定剧情。',
      };
      return result;
    }, {});
  }

  function monthlySummary(request, network, keyNodes) {
    var decade = request.time_layers.decade.palace;
    var annual = request.time_layers.annual.palace;
    return '在“大限' + decade + '（' + PALACE_ROLES[decade] + '）”的阶段背景下，' +
      '今年重点落在“流年' + annual + '（' + PALACE_ROLES[annual] + '）”；' +
      '本月流月命宫进入' + network.core + '，并同时牵动' + network.trines.map(function (item) { return item.palace; }).join('、') +
      '，对宫为' + network.opposite.palace + '。因此本月应优先处理' + PALACE_ROLES[network.core] +
      '，机会承接重点看' + keyNodes.opportunity_node.palace + '，而' + keyNodes.bottleneck_node.palace + '是最需要控制成本的节点。';
  }

  function monthlyActions(keyNodes, axes) {
    var actions = [
      '把本月最重要的决策、时间和注意力优先放在' + keyNodes.core_focus.palace + '对应的现实事项，而不是平均分配给所有领域。',
      '主动利用' + keyNodes.opportunity_node.palace + '的资源与承接条件，把机会变成可确认、可交付或可沉淀的结果。',
      '遇到' + keyNodes.bottleneck_node.palace + '相关事项时先做规则、边界和成本检查，不因为短期机会直接扩大投入。',
    ];
    ['身体', '事业', '钱', '爱情/关系'].forEach(function (axis) {
      if (axes[axis].relevance === '重点') actions.push(axis + '是本月重点轴之一；只围绕已被触发的宫位采取行动，不套用全年固定建议。');
    });
    return actions.filter(function (item, index) { return actions.indexOf(item) === index; });
  }

  function quality(request, network) {
    var issues = [];
    ['decade', 'annual', 'monthly'].forEach(function (layer) {
      var item = (request.time_layers || {})[layer];
      if (!item || !item.palace) issues.push('missing_' + layer + '_palace');
      else if (!item.computed_upstream) issues.push(layer + '_not_marked_computed_upstream');
    });
    if (!TRINES[network.core]) issues.push('unknown_monthly_palace');
    if (!request.time_layers.monthly.transformations || request.time_layers.monthly.transformations.length !== 4) {
      issues.push('monthly_transformations_incomplete');
    }
    return { status: issues.length ? 'fail' : 'pass', issues: issues };
  }

  function analyze(chart, request) {
    if (!config || !Object.keys(PALACE_ROLES).length) throw new Error('P5 本地月运配置未载入。');
    var monthly = request && request.time_layers && request.time_layers.monthly;
    if (!monthly || !monthly.palace) throw new Error('当前排盘模块尚未提供本月流月位置，无法生成月运。');
    if (!monthly.transformations || monthly.transformations.length !== 4) {
      throw new Error('当前排盘模块尚未提供完整的流月四化，无法生成月运。');
    }
    var network = monthlyNetwork(monthly.palace);
    var resonances = resonance(chart, request);
    var keyNodes = chooseKeyNodes(chart, request, network, resonances);
    var axes = axisAnalysis(request, network, resonances);
    return {
      meta: {
        engine: 'ZDSM Monthly Runtime', version: '1.0',
        target_month: request.target_month, calendar_label: request.calendar_label,
        prediction_mode: 'trend', ai_api_used: false,
      },
      layer_chain: LAYER_ORDER.filter(function (layer) { return request.time_layers[layer]; }).map(function (layer) {
        var palace = request.time_layers[layer].palace;
        return { layer: layerName(request, layer), palace: palace, role: PALACE_ROLES[palace] };
      }),
      monthly_core_network: network,
      transformations: normalizeTransformations(request),
      resonance_nodes: resonances,
      key_nodes: keyNodes,
      monthly_summary: monthlySummary(request, network, keyNodes),
      axes: axes,
      monthly_actions: monthlyActions(keyNodes, axes),
      quality_gate: quality(request, network),
    };
  }

  window.ZDSMMonthlyRuntime = { version: '1.0-browser-port', analyze: analyze };
}());
