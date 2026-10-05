(function () {
  'use strict';

  var TIME_OPTIONS = [
    ['早子时', '00:00–00:59'], ['丑时', '01:00–02:59'], ['寅时', '03:00–04:59'],
    ['卯时', '05:00–06:59'], ['辰时', '07:00–08:59'], ['巳时', '09:00–10:59'],
    ['午时', '11:00–12:59'], ['未时', '13:00–14:59'], ['申时', '15:00–16:59'],
    ['酉时', '17:00–18:59'], ['戌时', '19:00–20:59'], ['亥时', '21:00–22:59'],
    ['晚子时', '23:00–23:59'],
  ];

  var PALACE_POSITIONS = {
    0: [4, 1], 1: [3, 1], 2: [2, 1], 3: [1, 1], 4: [1, 2], 5: [1, 3],
    6: [1, 4], 7: [2, 4], 8: [3, 4], 9: [4, 4], 10: [4, 3], 11: [4, 2],
  };

  var SCOPE_LABELS = [
    ['大限', 'decadal'], ['小限', 'age'], ['流年', 'yearly'],
    ['流月', 'monthly'], ['流日', 'daily'], ['流时', 'hourly'],
  ];

  var TRANSIT_SCOPES = [
    ['decadal', '限'], ['yearly', '年'], ['monthly', '月'], ['daily', '日'], ['hourly', '时'],
  ];

  var LUNAR_MONTHS = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];
  var LUNAR_DAYS = ['', '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];

  var els = {};
  var runtime = {
    chart: null, input: null, horoscope: null, decadals: [], years: [], months: [],
    decadalPosition: 0, yearPosition: 0, monthPosition: 0, day: 1, timeIndex: 0,
    selectedPalaceIndex: null, relatedIndexes: [], relationRoles: {}, activeScopeLevel: 'daily', transitLevel: 'daily',
    flightRoutes: [], dateCache: {}, dayMetaCache: {}, knowledge: null, knowledgePromise: null,
    knowledgeError: '', localReport: null,
  };

  var SCOPE_DISPLAY_NAMES = {
    natal: '本命', decadal: '大限', yearly: '流年', monthly: '流月', daily: '流日', hourly: '流时', manual: '本宫',
  };

  var MUTAGEN_LABELS = ['禄', '权', '科', '忌'];
  var MUTAGEN_KEYS = ['lu', 'quan', 'ke', 'ji'];

  function byId(id) { return document.getElementById(id); }

  function transitLevelIndex(level) {
    return TRANSIT_SCOPES.findIndex(function (entry) { return entry[0] === level; });
  }

  function isTransitIncluded(level) {
    var index = transitLevelIndex(level === 'age' ? 'yearly' : level);
    return index >= 0 && index <= transitLevelIndex(runtime.transitLevel);
  }

  function parentTransitLevel(level) {
    var index = transitLevelIndex(level);
    return index > 0 ? TRANSIT_SCOPES[index - 1][0] : 'natal';
  }

  function setTransitLevel(level) {
    // Keep selection depth independent of a manually clicked palace.
    runtime.transitLevel = level;
    runtime.activeScopeLevel = level;
  }

  function transitSelectionText() {
    if (runtime.transitLevel === 'natal') return '本命盘';
    var parts = [scopeDisplayName(runtime.transitLevel) + '盘'];
    if (!isTransitIncluded('yearly')) {
      parts.push(runtime.decadals[runtime.decadalPosition].ageRange.join('–') + '岁');
    } else {
      parts.push(selectedYear().year + '年');
      if (isTransitIncluded('monthly')) parts.push(monthLabel(selectedMonth()));
      if (isTransitIncluded('daily')) parts.push(LUNAR_DAYS[runtime.day]);
      if (isTransitIncluded('hourly')) parts.push(TIME_OPTIONS[runtime.timeIndex][0]);
    }
    return parts.join(' · ');
  }

  function scopeDisplayName(level) {
    return level === 'decadal' && runtime.horoscope && runtime.horoscope.decadal.name === '童限' ? '童限' : SCOPE_DISPLAY_NAMES[level];
  }

  function setWorkspaceView(view) {
    document.body.dataset.view = view;
    var editing = view === 'input';
    byId('workspace-nav').hidden = editing;
    byId('reading-nav').hidden = view !== 'system' && view !== 'report';
    byId('back-to-input').hidden = editing;
    document.querySelectorAll('[data-view]').forEach(function (button) {
      if (button.tagName !== 'BUTTON') return;
      var active = button.dataset.view === view || (view === 'report' && button.dataset.view === 'system');
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    document.querySelectorAll('[data-reading]').forEach(function (button) {
      var active = button.dataset.reading === view;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    byId('profile-summary').textContent = runtime.chart ?
      runtime.chart.solarDate + ' · ' + runtime.chart.time + ' · ' + runtime.chart.gender : '紫微斗数排盘';
    hideStatus();
    if (window.ZDSMWorkspace) window.ZDSMWorkspace.remember();
  }

  function pad(value) { return String(value).padStart(2, '0'); }

  function usableContactChannels(contact) {
    return (contact.channels || []).filter(function (channel) {
      return typeof channel.value === 'string' && channel.value.trim() && !/请在部署时填写|待填写|TODO/.test(channel.value);
    });
  }

  function localDateValue(date) {
    return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-');
  }

  function normalizeDate(value) {
    var parts = String(value || '').split('-');
    if (parts.length !== 3) return String(value || '');
    return parts[0] + '-' + pad(parts[1]) + '-' + pad(parts[2]);
  }

  function hourToTimeIndex(hour) {
    if (hour === 23) return 12;
    if (hour === 0) return 0;
    return Math.floor((hour + 1) / 2);
  }

  function fillTimeOptions(select, selected) {
    select.innerHTML = TIME_OPTIONS.map(function (item, index) {
      return '<option value="' + index + '"' + (index === selected ? ' selected' : '') + '>' +
        item[0] + ' · ' + item[1] + '</option>';
    }).join('');
  }

  function fillDailyTimeOptions(select) {
    if (!select) return;
    select.innerHTML = '<option value="">全天 · 只看流日</option>' + TIME_OPTIONS.map(function (item, index) {
      return '<option value="' + index + '">' + item[0] + ' · ' + item[1] + '</option>';
    }).join('');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function splitKnowledgeTerms(value) {
    return String(value || '').split(';').map(function (item) { return item.trim(); }).filter(Boolean);
  }

  function knowledgeChips(value, className) {
    return splitKnowledgeTerms(value).map(function (item) {
      return '<span class="knowledge-chip ' + (className || '') + '">' + escapeHtml(item) + '</span>';
    }).join('');
  }

  function parseKnowledgeList(value) {
    if (!value) return [];
    try {
      var parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function confidenceLabel(value) {
    if (value === 'high') return '高置信';
    if (value === 'medium') return '中置信';
    if (value === 'low') return '低置信';
    return value || '未标';
  }

  function knowledgePalaceId(name) {
    if (name === '仆役') return '交友宫';
    return /宫$/.test(name) ? name : name + '宫';
  }

  function interactionMatches(side, starNames) {
    return String(side || '').split('/').some(function (name) {
      return starNames.indexOf(name) !== -1;
    });
  }

  function templeStateFor(starName, branch) {
    if (!runtime.knowledge) return null;
    return runtime.knowledge.templeStates.find(function (row) {
      return row.table_id === runtime.knowledge.recommendations.main_temple_table &&
        row.star_id === starName && row.branch === branch;
    }) || null;
  }

  function renderKnowledgePanel() {
    if (!els.knowledgeContent || !els.knowledgeVersion) return;
    if (runtime.knowledgeError) {
      els.knowledgeVersion.textContent = 'P4 未载入';
      els.knowledgeContent.innerHTML = '<div class="knowledge-empty error">' + escapeHtml(runtime.knowledgeError) + '</div>';
      return;
    }
    if (!runtime.knowledge) {
      els.knowledgeVersion.textContent = 'P4 载入中';
      els.knowledgeContent.innerHTML = '<div class="knowledge-empty">正在读取知识库。</div>';
      return;
    }

    els.knowledgeVersion.textContent = runtime.knowledge.version + ' · 本地规则';
    if (!runtime.chart || runtime.selectedPalaceIndex == null) {
      els.knowledgeContent.innerHTML = '<div class="knowledge-empty">生成命盘后，这里会随当前主宫显示可追溯的规则。</div>';
      return;
    }

    var palace = runtime.chart.palaces[runtime.selectedPalaceIndex];
    var palaceId = knowledgePalaceId(palace.name);
    var palaceRule = runtime.knowledge.palaces[palaceId];
    var seenStars = {};
    var allStars = [].concat(palace.majorStars || [], palace.minorStars || [], palace.adjectiveStars || []).filter(function (star) {
      if (!star || !star.name || seenStars[star.name]) return false;
      seenStars[star.name] = true;
      return true;
    });
    var starNames = allStars.map(function (star) { return star.name; });

    var palaceHtml = '<section class="knowledge-context"><div class="knowledge-context-title"><span>当前宫位</span><strong>' +
      escapeHtml(palaceId) + '</strong><em>' + escapeHtml(palace.heavenlyStem + palace.earthlyBranch) + '</em></div>';
    if (palaceRule) {
      palaceHtml += '<p>' + escapeHtml(palaceRule.system_role) + '</p><dl><div><dt>输入</dt><dd>' +
        knowledgeChips(palaceRule.inputs) + '</dd></div><div><dt>观察输出</dt><dd>' +
        knowledgeChips(palaceRule.outputs) + '</dd></div></dl>';
    }
    palaceHtml += '</section>';

    var majorCards = (palace.majorStars || []).map(function (star) {
      var record = runtime.knowledge.stars[star.name];
      if (!record) return '';
      var tableState = templeStateFor(star.name, palace.earthlyBranch);
      var starPalaceRule = runtime.knowledge.starPalaceRules[star.name + '|' + palaceId];
      var manifestations = starPalaceRule ? parseKnowledgeList(starPalaceRule.possible_manifestations_json) : [];
      var boundaries = starPalaceRule ? parseKnowledgeList(starPalaceRule.do_not_infer_json) : [];
      return '<article class="knowledge-star-card"><header><strong>' + escapeHtml(star.name) + '</strong><span>命盘 ' +
        escapeHtml(star.brightness || '未标') + (tableState ? ' · 全书表 ' + escapeHtml(tableState.state) : '') +
        '</span></header><div><b>核心功能</b>' + knowledgeChips(record.core_functions, 'positive') +
        '</div><div><b>失衡观察</b>' + knowledgeChips(record.dysregulation, 'caution') + '</div>' +
        (starPalaceRule ? '<p class="knowledge-palace-effect">' + escapeHtml(starPalaceRule.modern_core_effect) + '</p>' +
          '<details class="knowledge-rule-detail"><summary>现实观察与推断边界</summary>' +
          (manifestations.length ? '<ul>' + manifestations.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ul>' : '') +
          '<p><b>风险观察：</b>' + escapeHtml(starPalaceRule.risk_pattern) + '</p>' +
          (boundaries.length ? '<p><b>不得推出：</b>' + escapeHtml(boundaries.join('；')) + '</p>' : '') +
          '<small>' + escapeHtml(starPalaceRule.rule_id) + ' · ' + escapeHtml(confidenceLabel(starPalaceRule.confidence)) +
          ' · ' + escapeHtml(starPalaceRule.evidence_type) + ' · ' + escapeHtml(starPalaceRule.source_status) + '</small></details>' : '') +
        '</article>';
    }).join('');

    var auxiliaryCards = allStars.map(function (star) {
      var record = runtime.knowledge.auxiliaryStars[star.name];
      var detailRecord = runtime.knowledge.minorStars[star.name];
      if (!record && !detailRecord) return '';
      var operatorKey = record ? record.default_operator : detailRecord.category;
      var operator = runtime.knowledge.operators[operatorKey];
      var functions = record ? record.modern_functions : detailRecord.modern_functions;
      var evidence = record ? record.evidence_type + '｜' + record.source_basis : detailRecord.evidence_type + '｜P2细化层';
      return '<article class="knowledge-aux-card"><div><strong>' + escapeHtml(star.name) + '</strong><span>' +
        escapeHtml(operator ? operator.name_zh : operatorKey) + '</span></div><p>' +
        escapeHtml(splitKnowledgeTerms(functions).join(' · ')) + '</p><small>' +
        escapeHtml(evidence) + (detailRecord ? '｜不能覆盖主结构' : '') + '</small></article>';
    }).filter(Boolean).join('');

    var mainStarNames = (palace.majorStars || []).map(function (star) { return star.name; });
    var colocations = runtime.knowledge.colocations.filter(function (rule) {
      return rule.status === 'active' && rule.branch_group.indexOf(palace.earthlyBranch) !== -1 &&
        mainStarNames.indexOf(rule.star_a) !== -1 && mainStarNames.indexOf(rule.star_b) !== -1;
    });
    var colocationPairs = colocations.reduce(function (pairs, rule) {
      pairs[[rule.star_a, rule.star_b].sort().join('|')] = true;
      return pairs;
    }, {});
    var interactions = runtime.knowledge.interactions.filter(function (rule) {
      return rule.status === 'active' && starNames.indexOf(rule.star_a) !== -1 && interactionMatches(rule.star_b, starNames);
    }).filter(function (rule) {
      var matchedAlternative = String(rule.star_b || '').split('/').find(function (name) { return starNames.indexOf(name) !== -1; });
      return !matchedAlternative || !colocationPairs[[rule.star_a, matchedAlternative].sort().join('|')];
    });
    var matchedRules = colocations.concat(interactions);
    var interactionHtml = matchedRules.length ? matchedRules.map(function (rule) {
      var operator = runtime.knowledge.operators[rule.operator_id];
      return '<article class="knowledge-rule"><header><strong>' + escapeHtml(rule.star_a + ' × ' + rule.star_b) +
        '</strong><span>' + escapeHtml(operator ? operator.name_zh : rule.operator_id) + '</span></header><p>' +
        escapeHtml(rule.modern_effect || rule.effects_text) + '</p><small>' + escapeHtml(rule.colocation_id || rule.interaction_id) + ' · ' +
        escapeHtml(confidenceLabel(rule.confidence)) + ' · ' + escapeHtml(rule.source_id || rule.source_ids) + '</small></article>';
    }).join('') : '<div class="knowledge-empty compact">当前宫位没有命中 P1 可同宫组合或 P0 支援规则。</div>';

    var flightHtml = runtime.flightRoutes.map(function (route) {
      var meaning = runtime.knowledge.transformations[route.mutagen];
      return '<li class="knowledge-flight flight-text-' + route.key + '"><b>' + route.mutagen + '</b><div><strong>' +
        escapeHtml(route.starName + ' → ' + route.targetName + (route.isSelf ? '（自化）' : '')) + '</strong><span>' +
        escapeHtml(meaning ? splitKnowledgeTerms(meaning.meanings).join(' · ') : '') + '</span><small>不等于：' +
        escapeHtml(meaning ? meaning.not_equal_to : '固定吉凶') + '</small></div></li>';
    }).join('');

    var timeDetails = [
      ['长生', palace.changsheng12, runtime.knowledge.changsheng[palace.changsheng12]],
      ['博士', palace.boshi12, runtime.knowledge.boshi[palace.boshi12]],
      ['岁前', palace.suiqian12, runtime.knowledge.taisui[palace.suiqian12]],
      ['将前', palace.jiangqian12, runtime.knowledge.minorStars[palace.jiangqian12] || runtime.knowledge.yearBranchStars[palace.jiangqian12]],
    ];
    var activeLayers = SCOPE_LABELS.filter(function (entry) {
      return isTransitIncluded(entry[1]) && runtime.horoscope && runtime.horoscope[entry[1]] && runtime.horoscope[entry[1]].index === palace.index;
    }).map(function (entry) { return entry[0]; });
    var timeHtml = timeDetails.map(function (item) {
      var detail = item[2] || {};
      var meaning = detail.modern_meaning || detail.modern_functions || detail.policy || '仅作细化标记';
      return '<li><span>' + escapeHtml(item[0]) + '</span><strong>' + escapeHtml(item[1] || '—') + '</strong><small>' +
        escapeHtml(splitKnowledgeTerms(meaning).join(' · ')) + '</small></li>';
    }).join('');
    if (activeLayers.length) {
      timeHtml += '<li class="active-time-layers"><span>当前激活</span><strong>' + escapeHtml(activeLayers.join(' · ')) +
        '</strong><small>短周期只做时间定位，不能推翻本命与长期层。</small></li>';
    }

    var functionalEdges = runtime.knowledge.functionalEdges.filter(function (edge) {
      return edge.source === palaceId || edge.target === palaceId;
    });
    var functionalHtml = functionalEdges.length ? functionalEdges.map(function (edge) {
      var outgoing = edge.source === palaceId;
      return '<li class="' + (outgoing ? 'outgoing' : 'incoming') + '"><span>' +
        escapeHtml(outgoing ? palaceId + ' → ' + edge.target : edge.source + ' → ' + palaceId) + '</span><strong>' +
        escapeHtml(edge.label) + '</strong><small>' + escapeHtml(edge.evidence_type) + ' · ZDSM功能边</small></li>';
    }).join('') : '<li class="knowledge-empty compact">当前宫位没有收录功能边。</li>';

    var auditHtml = runtime.knowledge.audits.map(function (audit) {
      return '<li><b>' + escapeHtml(audit.topic) + '</b><span>' + escapeHtml(audit.detail) + '</span></li>';
    }).join('');

    els.knowledgeContent.innerHTML = palaceHtml + '<div class="knowledge-ledger">' +
      '<section class="knowledge-block"><header><h3>主星×宫位</h3><span>P1规则＋庙旺对照</span></header><div class="knowledge-star-grid">' +
      (majorCards || '<div class="knowledge-empty compact">此宫为空宫，没有主星机制卡。</div>') + '</div></section>' +
      '<section class="knowledge-block"><header><h3>辅煞与细化星</h3><span>P0高权重＋P2低权重</span></header><div class="knowledge-aux-grid">' +
      (auxiliaryCards || '<div class="knowledge-empty compact">此宫没有命中已收录的辅煞或细化星。</div>') + '</div></section>' +
      '<section class="knowledge-block"><header><h3>组合规则</h3><span>P1同宫组合＋P0支援</span></header><div class="knowledge-rule-grid">' +
      interactionHtml + '</div></section>' +
      '<section class="knowledge-block"><header><h3>当前四化语义</h3><span>采用命盘引擎飞入结果</span></header><ul class="knowledge-flights">' +
      flightHtml + '</ul></section>' +
      '<section class="knowledge-block"><header><h3>时间与细节层</h3><span>P2门控，不覆盖上层</span></header><ul class="knowledge-time-list">' +
      timeHtml + '</ul></section>' +
      '<section class="knowledge-block"><header><h3>系统功能链</h3><span>P4当前宫位关联边</span></header><ul class="knowledge-edge-list">' +
      functionalHtml + '</ul></section></div>' +
      '<details class="knowledge-audit"><summary>查看版本冲突与待核事项（' + runtime.knowledge.audits.length + '）</summary><ul>' +
      auditHtml + '</ul></details>';
  }

  function showStatus(message, isError) {
    els.status.textContent = message;
    els.status.className = 'status visible' + (isError ? ' error' : '');
  }

  function hideStatus() {
    els.status.className = 'status';
    els.status.textContent = '';
  }

  function formValue(id) { return byId(id).value; }

  function palaceNameAt(chart, index) {
    var palace = chart.palaces[index];
    return palace ? palace.name : '—';
  }

  function formatStar(star) {
    if (!star) return '';
    var brightness = star.brightness ? '<span class="star-meta">' + escapeHtml(star.brightness) + '</span>' : '';
    var mutagen = star.mutagen ? '<span class="star-mutagen mutagen-' + escapeHtml(star.mutagen) + '">化' + escapeHtml(star.mutagen) + '</span>' : '';
    return '<span>' + escapeHtml(star.name) + brightness + mutagen + '</span>';
  }

  function formatStars(stars, emptyText) {
    if (!stars || !stars.length) return '<span class="empty">' + (emptyText || '无') + '</span>';
    return stars.map(formatStar).join('、');
  }

  function chartStars(stars, type) {
    return (stars || []).map(function (star) {
      return '<span class="chart-star ' + type + '"><span class="chart-star-name">' + escapeHtml(star.name) +
        '</span><span class="chart-star-state">' + escapeHtml(star.brightness || '') + '</span>' +
        (star.mutagen ? '<span class="chart-star-mutagen mutagen-' + escapeHtml(star.mutagen) + '">' + escapeHtml(star.mutagen) + '</span>' : '') + '</span>';
    }).join('');
  }

  function scopeBadgesForPalace(horoscope, palaceIndex) {
    return TRANSIT_SCOPES.filter(function (entry) {
      return isTransitIncluded(entry[0]) && horoscope[entry[0]] && horoscope[entry[0]].index === palaceIndex;
    }).map(function (entry) {
      return '<span class="landing-marker marker-' + entry[0] + '" title="' + entry[1] + '落宫">' + entry[1] + '</span>';
    }).join('');
  }

  function scopeRowsForPalace(horoscope, palaceIndex) {
    return TRANSIT_SCOPES.filter(function (entry) { return entry[0] === runtime.transitLevel; }).map(function (entry) {
      var scope = horoscope[entry[0]];
      if (!scope || !isTransitIncluded(entry[0])) return '';
      var palaceLabel = scope.palaceNames && scope.palaceNames[palaceIndex] ? scope.palaceNames[palaceIndex] : '—';
      var stars = scope.stars && scope.stars[palaceIndex] ? scope.stars[palaceIndex] : [];
      var starNames = stars.length ? stars.map(function (star) { return escapeHtml(star.name); }).join('、') : '无流曜';
      return '<div class="transit-scope-line scope-line-' + entry[0] + '"><b>' + escapeHtml(scopeDisplayName(entry[0]) + '·' + palaceLabel) + '</b><span>' + starNames + '</span></div>';
    }).join('');
  }

  function buildFlightRoutes() {
    if (!runtime.chart || !runtime.horoscope || runtime.selectedPalaceIndex == null) return [];
    var sourceIndex = runtime.selectedPalaceIndex;
    var starNames = [];
    var sourceLabel = '';

    if (runtime.activeScopeLevel === 'manual') {
      var sourcePalace = runtime.chart.palaces[sourceIndex];
      sourceLabel = sourcePalace.name + '宫干';
      if (window.iztro.util && window.iztro.util.getMutagensByHeavenlyStem) {
        starNames = window.iztro.util.getMutagensByHeavenlyStem(sourcePalace.heavenlyStem);
      }
    } else {
      var scope = runtime.horoscope[runtime.activeScopeLevel];
      sourceLabel = scopeDisplayName(runtime.activeScopeLevel);
      starNames = scope && scope.mutagen ? scope.mutagen : [];
    }

    return MUTAGEN_LABELS.map(function (mutagen, index) {
      var starName = starNames[index];
      if (!starName) return null;
      try {
        var target = runtime.chart.star(starName).palace();
        return {
          mutagen: mutagen,
          key: MUTAGEN_KEYS[index],
          starName: starName,
          sourceIndex: sourceIndex,
          sourceLabel: sourceLabel,
          targetIndex: target.index,
          targetName: target.name,
          returnsToSource: target.index === sourceIndex,
          // Only a palace-stem flight can establish that palace's self-transformation.
          isSelf: runtime.activeScopeLevel === 'manual' && target.index === sourceIndex &&
            runtime.chart.palaces[sourceIndex].selfMutaged(mutagen),
        };
      } catch (error) {
        return null;
      }
    }).filter(Boolean);
  }

  function flightBadgesForPalace(palaceIndex) {
    return runtime.flightRoutes.filter(function (route) {
      return route.targetIndex === palaceIndex;
    }).map(function (route) {
      return '<span class="flight-endpoint flight-' + route.key + '">' + route.mutagen + '·' +
        escapeHtml(route.starName) + (route.isSelf ? '·自化' : '') + '</span>';
    }).join('');
  }

  function flightSummary() {
    if (!runtime.flightRoutes.length) return '';
    return '<section class="flight-summary"><div><strong>' + escapeHtml(runtime.flightRoutes[0].sourceLabel) +
      '四化飞入</strong><span>禄绿／权紫／科蓝／忌红</span></div><ul>' +
      runtime.flightRoutes.map(function (route) {
        return '<li class="flight-text-' + route.key + '"><b>' + route.mutagen + '</b><span>' +
          escapeHtml(route.starName) + ' → ' + escapeHtml(route.targetName) + (route.isSelf ? '（自化）' : '') +
          '</span></li>';
      }).join('') + '</ul></section>';
  }

  function palaceCard(palace, horoscope) {
    var position = PALACE_POSITIONS[palace.index] || [1, 1];
    var scopeBadges = scopeBadgesForPalace(horoscope, palace.index);
    var flightBadges = flightBadgesForPalace(palace.index);
    var classes = ['palace'];
    if (scopeBadges) classes.push('current-scope');
    if (runtime.selectedPalaceIndex === palace.index) classes.push('selected-palace');
    if (runtime.relatedIndexes.indexOf(palace.index) !== -1) classes.push('related-palace');
    if (runtime.relationRoles.opposite === palace.index) classes.push('relation-opposite');
    if (runtime.relationRoles.wealth === palace.index) classes.push('relation-wealth');
    if (runtime.relationRoles.career === palace.index) classes.push('relation-career');
    var identityBadges = '';
    if (runtime.selectedPalaceIndex === palace.index) {
      identityBadges += '<span class="badge relation-tag relation-main">' +
        escapeHtml(runtime.activeScopeLevel === 'manual' ? '本宫' : scopeDisplayName(runtime.activeScopeLevel) + '主宫') + '</span>';
    }
    if (runtime.relationRoles.opposite === palace.index) identityBadges += '<span class="badge relation-tag relation-opposite-tag">对宫</span>';
    if (runtime.relationRoles.wealth === palace.index) identityBadges += '<span class="badge relation-tag relation-wealth-tag">财帛位</span>';
    if (runtime.relationRoles.career === palace.index) identityBadges += '<span class="badge relation-tag relation-career-tag">官禄位</span>';
    if (palace.isBodyPalace) identityBadges += '<span class="badge body">身宫</span>';
    if (palace.isOriginalPalace) identityBadges += '<span class="badge original">来因宫</span>';

    return '<article class="' + classes.join(' ') + '" style="grid-row:' + position[0] + ';grid-column:' + position[1] + '" ' +
      'data-palace-index="' + palace.index + '" role="button" tabindex="0" aria-label="查看' + escapeHtml(palace.name) + '详情">' +
      '<div class="palace-stars">' + (palace.majorStars.length ? chartStars(palace.majorStars, 'major') : '<span class="empty-palace">空宫</span>') +
      chartStars(palace.minorStars, 'minor') + '</div>' +
      '<div class="palace-adjectives">' + palace.adjectiveStars.map(function (star) { return '<span>' + escapeHtml(star.name) + '</span>'; }).join('') + '</div>' +
      '<div class="flight-endpoints" aria-label="四化飞入">' + flightBadges + '</div>' +
      scopeRowsForPalace(horoscope, palace.index) +
      '<div class="badges">' + identityBadges + '</div>' +
      '<header class="palace-head"><div class="palace-title"><h3>' + escapeHtml(palace.name) + '</h3>' +
      '<span class="palace-age">' + escapeHtml(palace.decadal.range.join('–')) + '</span></div>' +
      '<div class="palace-corner"><span class="stem-branch">' + escapeHtml(palace.heavenlyStem) + escapeHtml(palace.earthlyBranch) + '</span>' +
      '<div class="landing-markers">' + scopeBadges + '</div></div></header>' +
      '</article>';
  }

  function selectedPalaceDetail(chart, horoscope) {
    if (runtime.selectedPalaceIndex == null) {
      return '<div class="palace-inspector empty-inspector"><strong>命盘可点击</strong><span>点击任一宫位，查看三方四正与该宫的五层运限。</span></div>';
    }
    var palace = chart.palaces[runtime.selectedPalaceIndex];
    var surrounded = chart.surroundedPalaces(runtime.selectedPalaceIndex);
    var scopeLines = TRANSIT_SCOPES.map(function (entry) {
      if (!isTransitIncluded(entry[0])) return '';
      var scope = horoscope[entry[0]];
      var name = scope && scope.palaceNames ? scope.palaceNames[runtime.selectedPalaceIndex] : '—';
      var stars = scope && scope.stars && scope.stars[runtime.selectedPalaceIndex] ? scope.stars[runtime.selectedPalaceIndex] : [];
      return '<div><dt>' + entry[1] + escapeHtml(name) + '</dt><dd>' +
        (stars.length ? stars.map(function (star) { return escapeHtml(star.name); }).join('、') : '无流曜') + '</dd></div>';
    }).join('');
    return '<div class="palace-inspector"><div class="inspector-title"><strong>' + escapeHtml(palace.name) + '</strong><span>' +
      escapeHtml(palace.heavenlyStem + palace.earthlyBranch) + '</span></div><p>三方四正：对宫 ' + escapeHtml(surrounded.opposite.name) +
      ' · 财帛位 ' + escapeHtml(surrounded.wealth.name) + ' · 官禄位 ' + escapeHtml(surrounded.career.name) +
      '</p><dl>' + scopeLines + '</dl></div>';
  }

  function centerPanel(chart, horoscope, input) {
    return '<section class="chart-center">' +
      '<div class="center-topline"><span class="view-date">' + escapeHtml(transitSelectionText()) +
      '</span></div><h3>' + escapeHtml(chart.fiveElementsClass) + '</h3>' +
      '<dl class="center-summary">' +
      '<div><dt>性别</dt><dd>' + escapeHtml(chart.gender) + '</dd></div>' +
      '<div><dt>公历</dt><dd>' + escapeHtml(chart.solarDate) + '</dd></div>' +
      '<div><dt>农历</dt><dd>' + escapeHtml(chart.lunarDate) + '</dd></div>' +
      '<div><dt>命宫</dt><dd>' + escapeHtml(chart.earthlyBranchOfSoulPalace) + '</dd></div>' +
      '<div><dt>身宫</dt><dd>' + escapeHtml(chart.earthlyBranchOfBodyPalace) + '</dd></div>' +
      '<div><dt>命主</dt><dd>' + escapeHtml(chart.soul) + '</dd></div>' +
      '<div><dt>身主</dt><dd>' + escapeHtml(chart.body) + '</dd></div>' +
      '<div><dt>时辰</dt><dd>' + escapeHtml(chart.time) + '</dd></div>' +
      '</dl>' + flightSummary() + '</section>';
  }

  function mobileRelationCard(palaceIndex, role, label) {
    var palace = runtime.chart.palaces[palaceIndex];
    if (!palace) return '';
    var majorStars = (palace.majorStars || []).map(function (star) { return escapeHtml(star.name); }).join('、') || '空宫';
    var scope = runtime.transitLevel === 'natal' ? null : runtime.horoscope[runtime.transitLevel];
    var scopePalace = scope && scope.palaceNames ? scope.palaceNames[palaceIndex] : '';
    var scopeStars = scope && scope.stars && scope.stars[palaceIndex] ? scope.stars[palaceIndex] : [];
    var scopeText = scopeStars.length ? scopeStars.map(function (star) { return escapeHtml(star.name); }).join('、') : '无流曜';
    return '<button type="button" class="mobile-relation-card role-' + role + '" data-mobile-palace-index="' + palaceIndex + '" ' +
      'aria-label="查看' + escapeHtml(label + palace.name) + '"><span class="mobile-relation-role">' + escapeHtml(label) + '</span>' +
      '<strong>' + escapeHtml(palace.name) + '</strong><span class="mobile-relation-stars">' + majorStars + '</span>' +
      (scopePalace ? '<small>' + escapeHtml(scopeDisplayName(runtime.transitLevel) + '·' + scopePalace) + '｜' + scopeText + '</small>' : '') +
      '</button>';
  }

  function renderMobileRelationMap() {
    if (!els.mobileRelationMap || runtime.selectedPalaceIndex == null) return;
    var main = runtime.chart.palaces[runtime.selectedPalaceIndex];
    var focusLabel = runtime.activeScopeLevel === 'manual' ? '所选本宫' : scopeDisplayName(runtime.activeScopeLevel) + '主宫';
    var routeHtml = runtime.flightRoutes.length ? runtime.flightRoutes.map(function (route) {
      return '<li class="flight-text-' + route.key + '"><b>' + route.mutagen + '</b><span>' +
        escapeHtml(route.starName) + ' → ' + escapeHtml(route.targetName) + (route.isSelf ? ' · 自化' : '') + '</span></li>';
    }).join('') : '<li class="mobile-route-empty">当前层暂无四化路线</li>';
    els.mobileRelationMap.innerHTML = '<header class="mobile-relation-heading"><div><span>' + escapeHtml(transitSelectionText()) +
      '</span><h3>' + escapeHtml(main.name) + '的关系网</h3></div><p>点任一宫可切换主宫</p></header>' +
      '<div class="mobile-relation-network"><div class="mobile-relation-main">' +
      mobileRelationCard(runtime.selectedPalaceIndex, 'main', focusLabel) + '</div>' +
      '<div class="mobile-relation-axis"><span></span><b>三方四正</b><span></span></div>' +
      '<div class="mobile-relation-related">' +
      mobileRelationCard(runtime.relationRoles.wealth, 'wealth', '财帛位') +
      mobileRelationCard(runtime.relationRoles.opposite, 'opposite', '对宫') +
      mobileRelationCard(runtime.relationRoles.career, 'career', '官禄位') + '</div></div>' +
      '<section class="mobile-flight-routes"><header><strong>' + escapeHtml(runtime.flightRoutes.length ? runtime.flightRoutes[0].sourceLabel : main.name) +
      '四化流向</strong><span>禄 · 权 · 科 · 忌</span></header><ul>' + routeHtml + '</ul></section>';
  }

  function renderFacts(chart, horoscope, input) {
    var method = input.algorithm === 'zhongzhou' ? '中州派' : '通行版本';
    var divideLabels = { normal: '农历正月初一', exact: '立春' };
    var ageLabels = { normal: '自然年', birthday: '农历生日' };
    var dayLabels = { current: '算当日', forward: '算次日' };
    els.methodLine.textContent = '口径：' + method + '｜年界：' + divideLabels[input.yearDivide] + '｜运限分界：' +
      divideLabels[input.horoscopeDivide] + '｜小限分界：' + ageLabels[input.ageDivide] + '｜晚子时：' + dayLabels[input.dayDivide] +
      '｜闰月修正：' + (input.fixLeap ? '开启' : '关闭');
    els.generatedAt.textContent = transitSelectionText();
  }

  function flattenDynamicStars(scope) {
    if (!scope || !scope.stars) return [];
    return scope.stars.reduce(function (all, group) { return all.concat(group || []); }, []);
  }

  function formatMutagenStars(stars) {
    var labels = ['禄', '权', '科', '忌'];
    if (!stars || !stars.length) return '—';
    return stars.map(function (star, index) {
      return (labels[index] || String(index + 1)) + '：' + star;
    }).join('、');
  }

  function renderScopeTable(chart, horoscope) {
    if (!els.scopeTable) return;
    els.scopeTable.innerHTML = SCOPE_LABELS.map(function (entry) {
      if (!isTransitIncluded(entry[1])) return '';
      var scope = horoscope[entry[1]];
      var stars = flattenDynamicStars(scope);
      var mutagens = scope ? formatMutagenStars(scope.mutagen) : '—';
      var stemBranch = scope ? String(scope.heavenlyStem || '') + String(scope.earthlyBranch || '') : '—';
      var palaceName = scope ? palaceNameAt(chart, scope.index) : '—';
      return '<tr><td>' + entry[0] + (entry[1] === 'age' && scope ? ' · 虚岁' + scope.nominalAge : '') + '</td>' +
        '<td>' + escapeHtml(palaceName) + '</td><td>' + escapeHtml(stemBranch) + '</td>' +
        '<td>' + escapeHtml(mutagens) + '</td><td>' + (stars.length ? formatStars(stars) : '<span class="empty">无流曜</span>') + '</td></tr>';
    }).join('');
  }

  function renderAuditTable(chart) {
    if (!els.auditTable) return;
    els.auditTable.innerHTML = chart.palaces.map(function (palace) {
      var surrounded = chart.surroundedPalaces(palace.index);
      return '<tr><td>' + escapeHtml(palace.name) + '</td>' +
        '<td>' + escapeHtml(palace.heavenlyStem + palace.earthlyBranch) + '</td>' +
        '<td>' + escapeHtml(surrounded.opposite.name) + '</td>' +
        '<td>' + escapeHtml(surrounded.wealth.name) + '</td>' +
        '<td>' + escapeHtml(surrounded.career.name) + '</td>' +
        '<td>' + escapeHtml(palace.decadal.range.join('–')) + '岁</td>' +
        '<td>' + escapeHtml(palace.ages.join('、')) + '</td></tr>';
    }).join('');
  }

  function transitStemBranch(scope) {
    return scope ? String(scope.heavenlyStem || '') + String(scope.earthlyBranch || '') : '—';
  }

  function selectedYear() { return runtime.years[runtime.yearPosition]; }
  function selectedMonth() { return runtime.months[runtime.monthPosition]; }

  function monthLabel(item) {
    var label = LUNAR_MONTHS[item.month - 1] || item.month + '月';
    if (item.isLeapMonth) label = '闰' + label;
    if (item.part === 'first') label += '上半月';
    if (item.part === 'second') label += '下半月';
    return label;
  }

  function lunarDateToSolar(year, monthItem, day) {
    var key = [year, monthItem.month, day, monthItem.isLeapMonth ? 1 : 0].join('-');
    if (runtime.dateCache[key]) return runtime.dateCache[key];
    var converted = window.iztro.astro.byLunar(
      year + '-' + monthItem.month + '-' + day,
      6,
      runtime.input.gender,
      monthItem.isLeapMonth,
      false,
      'zh-CN'
    );
    runtime.dateCache[key] = normalizeDate(converted.solarDate);
    return runtime.dateCache[key];
  }

  function dayMeta(day) {
    var year = selectedYear().year;
    var month = selectedMonth();
    var key = [year, month.month, month.isLeapMonth ? 1 : 0, day, runtime.timeIndex, runtime.input.dayDivide].join('-');
    if (!runtime.dayMetaCache[key]) {
      var solarDate = lunarDateToSolar(year, month, day);
      runtime.dayMetaCache[key] = {
        solarDate: solarDate,
        stemBranch: transitStemBranch(runtime.chart.horoscope(solarDate, runtime.timeIndex).daily),
      };
    }
    return runtime.dayMetaCache[key];
  }

  function transitOption(level, value, selected, primary, secondary, title) {
    selected = selected && isTransitIncluded(level);
    if (selected) title = (title ? title + '；' : '') + '再次点击取消，返回' + SCOPE_DISPLAY_NAMES[parentTransitLevel(level)] + '盘';
    return '<button type="button" class="transit-option option-' + level + (selected ? ' selected' : '') + '" ' +
      'data-level="' + level + '" data-value="' + value + '" role="option" aria-selected="' + (selected ? 'true' : 'false') + '"' +
      (title ? ' title="' + escapeHtml(title) + '"' : '') + '><strong>' + escapeHtml(primary) + '</strong><span>' + escapeHtml(secondary) + '</span></button>';
  }

  function renderTransitPicker() {
    els.decadalOptions.innerHTML = runtime.decadals.map(function (item, index) {
      return transitOption('decadal', index, index === runtime.decadalPosition, item.ageRange.join('–') + '岁',
        item.childhood ? '童限 · 起限前' : item.palaceName + ' · ' + transitStemBranch(item), item.yearRange.join('–') + '年');
    }).join('');

    els.yearlyOptions.innerHTML = runtime.years.map(function (item, index) {
      return transitOption('yearly', index, index === runtime.yearPosition, item.year + '年',
        transitStemBranch(item) + ' · 虚岁' + item.age, '选择' + item.year + '年');
    }).join('');

    els.monthlyOptions.innerHTML = runtime.months.map(function (item, index) {
      return transitOption('monthly', index, index === runtime.monthPosition, monthLabel(item),
        transitStemBranch(item), item.dayRange.join('–') + '日');
    }).join('');

    var month = selectedMonth();
    var days = [];
    for (var day = month.dayRange[0]; day <= month.dayRange[1]; day += 1) days.push(day);
    els.dailyOptions.innerHTML = days.map(function (dayNumber) {
      var meta = dayMeta(dayNumber);
      return transitOption('daily', dayNumber, dayNumber === runtime.day, LUNAR_DAYS[dayNumber], meta.stemBranch, meta.solarDate);
    }).join('');

    els.hourlyOptions.innerHTML = TIME_OPTIONS.map(function (item, index) {
      var hourly = runtime.chart.horoscope(runtime.input.targetDate, index).hourly;
      return transitOption('hourly', index, index === runtime.timeIndex, item[0], transitStemBranch(hourly), item[1]);
    }).join('');

    els.selectionSummary.textContent = transitSelectionText() + (isTransitIncluded('daily') ? '｜公历 ' + runtime.input.targetDate : '');
    ensureTransitSelectionVisible();
  }

  function ensureTransitSelectionVisible() {
    // Scroll only the option strip, never the document or its chart.
    [els.decadalOptions, els.yearlyOptions, els.monthlyOptions, els.hourlyOptions].forEach(function (row) {
      var active = row.querySelector('.selected');
      if (active && row.clientWidth) {
        row.scrollLeft += active.getBoundingClientRect().left - row.getBoundingClientRect().left - (row.clientWidth - active.clientWidth) / 2;
      }
    });
  }

  function renderInteractiveChart() {
    runtime.localReport = null;
    runtime.flightRoutes = buildFlightRoutes();
    els.chartGrid.dataset.scope = runtime.activeScopeLevel;
    els.chartGrid.dataset.transitLevel = runtime.transitLevel;
    els.chartGrid.innerHTML = runtime.chart.palaces.map(function (palace) {
      return palaceCard(palace, runtime.horoscope);
    }).join('') + centerPanel(runtime.chart, runtime.horoscope, runtime.input) +
      '<svg class="flight-overlay" data-flight-overlay="true" aria-hidden="true"></svg>';
    renderMobileRelationMap();
    renderFlightOverlay();
    window.requestAnimationFrame(renderFlightOverlay);
    renderKnowledgePanel();
    var selected = runtime.chart.palaces[runtime.selectedPalaceIndex];
    byId('knowledge-title').textContent = selected ? selected.name + ' · 宫位详解' : '所选宫位详解';
    if (window.ZDSMWorkspace) window.ZDSMWorkspace.remember();
  }

  function cardCenter(rect, gridRect) {
    return {
      x: rect.left - gridRect.left + rect.width / 2,
      y: rect.top - gridRect.top + rect.height / 2,
    };
  }

  function cardEdge(rect, gridRect, toward, inset) {
    var center = cardCenter(rect, gridRect);
    var dx = toward.x - center.x;
    var dy = toward.y - center.y;
    var halfWidth = Math.max(1, rect.width / 2 - inset);
    var halfHeight = Math.max(1, rect.height / 2 - inset);
    var tx = Math.abs(dx) > 0.001 ? halfWidth / Math.abs(dx) : Infinity;
    var ty = Math.abs(dy) > 0.001 ? halfHeight / Math.abs(dy) : Infinity;
    var scale = Math.min(tx, ty);
    if (!Number.isFinite(scale)) scale = 0;
    return { x: center.x + dx * scale, y: center.y + dy * scale };
  }

  function renderFlightOverlay() {
    if (!els.chartGrid || !runtime.flightRoutes.length) return;
    var overlay = els.chartGrid.querySelector('[data-flight-overlay]');
    if (!overlay) return;

    var gridRect = els.chartGrid.getBoundingClientRect();
    if (!gridRect.width || !gridRect.height) return;
    var source = els.chartGrid.querySelector('[data-palace-index="' + runtime.flightRoutes[0].sourceIndex + '"]');
    if (!source) return;
    var sourceRect = source.getBoundingClientRect();
    var definitions = '<defs>' + MUTAGEN_KEYS.map(function (key) {
      return '<marker id="flight-arrow-' + key + '" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">' +
        '<path d="M0,0 L0,6 L7,3 z" class="flight-arrowhead flight-fill-' + key + '"></path></marker>';
    }).join('') + '</defs>';
    var paths = [];

    runtime.flightRoutes.forEach(function (route, index) {
      var target = els.chartGrid.querySelector('[data-palace-index="' + route.targetIndex + '"]');
      if (!target) return;
      var pathData = '';

      if (route.returnsToSource) {
        var center = cardCenter(sourceRect, gridRect);
        var loopWidth = Math.min(sourceRect.width * 0.34, 58) + index * 3;
        var loopHeight = Math.min(sourceRect.height * 0.24, 34) + index * 2;
        var startX = center.x + loopWidth * 0.35;
        var startY = center.y - loopHeight * 0.3;
        pathData = 'M ' + startX + ' ' + startY + ' C ' +
          (center.x + loopWidth) + ' ' + (center.y - loopHeight) + ', ' +
          (center.x + loopWidth) + ' ' + (center.y + loopHeight) + ', ' +
          (center.x + loopWidth * 0.28) + ' ' + (center.y + loopHeight * 0.35);
      } else {
        var targetRect = target.getBoundingClientRect();
        var sourceCenter = cardCenter(sourceRect, gridRect);
        var targetCenter = cardCenter(targetRect, gridRect);
        var start = cardEdge(sourceRect, gridRect, targetCenter, 13 + index * 2);
        var end = cardEdge(targetRect, gridRect, sourceCenter, 16 + index * 2);
        var dx = end.x - start.x;
        var dy = end.y - start.y;
        var bend = (index - 1.5) * 8;
        var controlX1 = start.x + dx * 0.34 - dy * bend / 180;
        var controlY1 = start.y + dy * 0.34 + dx * bend / 180;
        var controlX2 = start.x + dx * 0.68 - dy * bend / 180;
        var controlY2 = start.y + dy * 0.68 + dx * bend / 180;
        pathData = 'M ' + start.x + ' ' + start.y + ' C ' + controlX1 + ' ' + controlY1 + ', ' +
          controlX2 + ' ' + controlY2 + ', ' + end.x + ' ' + end.y;
      }
      paths.push('<path class="flight-path flight-path-' + route.key + '" marker-end="url(#flight-arrow-' + route.key +
        ')" data-mutagen="' + route.mutagen + '" d="' + pathData + '"></path>');
    });
    overlay.setAttribute('viewBox', '0 0 ' + gridRect.width + ' ' + gridRect.height);
    overlay.innerHTML = definitions + paths.join('');
  }

  function applyPalaceFocus(index) {
    runtime.selectedPalaceIndex = index;
    var surrounded = runtime.chart.surroundedPalaces(index);
    runtime.relationRoles = {
      opposite: surrounded.opposite.index,
      wealth: surrounded.wealth.index,
      career: surrounded.career.index,
    };
    runtime.relatedIndexes = [runtime.relationRoles.opposite, runtime.relationRoles.wealth, runtime.relationRoles.career];
  }

  function applyActiveScopeFocus() {
    var scope = runtime.activeScopeLevel === 'natal' ? runtime.chart.palaces.find(function (palace) {
      return palace.name === '命宫' || palace.name === '命';
    }) : runtime.horoscope[runtime.activeScopeLevel];
    if (scope && Number.isInteger(scope.index)) {
      applyPalaceFocus(scope.index);
    } else {
      runtime.selectedPalaceIndex = null;
      runtime.relatedIndexes = [];
      runtime.relationRoles = {};
    }
  }

  function updateFromSelection() {
    var solarDate = lunarDateToSolar(selectedYear().year, selectedMonth(), runtime.day);
    validateTargetDate(runtime.chart, solarDate);
    runtime.input.targetDate = solarDate;
    runtime.input.targetTime = runtime.timeIndex;
    byId('target-date').value = solarDate;
    byId('target-time').value = String(runtime.timeIndex);
    var level = runtime.transitLevel;
    var horoscope = runtime.chart.horoscope(solarDate, runtime.timeIndex);
    // Changing a date can also cross a birthday-based decade boundary.
    initTransitNavigator(runtime.chart, runtime.input, horoscope);
    setTransitLevel(level);
    applyActiveScopeFocus();
    renderFacts(runtime.chart, runtime.horoscope, runtime.input);
    renderInteractiveChart();
    renderScopeTable(runtime.chart, runtime.horoscope);
    renderTransitPicker();
    showStatus('已切换到 ' + transitSelectionText() +
      '；命盘宫名、流曜、四化和落宫颜色已同步更新。', false);
  }

  function resetAfter(level) {
    if (level === 'decadal') {
      runtime.years = yearsForDecadal(runtime.decadalPosition);
      runtime.yearPosition = 0;
    }
    if (level === 'decadal' || level === 'yearly') {
      runtime.months = runtime.chart.monthlyList(selectedYear().year, runtime.input.fixLeap);
      runtime.monthPosition = runtime.months.findIndex(function (month) {
        return lunarDateToSolar(selectedYear().year, month, month.dayRange[1]) >= normalizeDate(runtime.chart.solarDate);
      });
      if (runtime.monthPosition < 0) throw new Error('所选年份早于出生日期。');
    }
    if (level === 'decadal' || level === 'yearly' || level === 'monthly') {
      runtime.day = selectedMonth().dayRange[0];
      while (runtime.day <= selectedMonth().dayRange[1] &&
        lunarDateToSolar(selectedYear().year, selectedMonth(), runtime.day) < normalizeDate(runtime.chart.solarDate)) runtime.day += 1;
      if (runtime.day > selectedMonth().dayRange[1]) throw new Error('所选月份早于出生日期。');
    }
  }

  function changeTransitSelection(level, value) {
    var previous = Object.assign({}, runtime, { input: Object.assign({}, runtime.input) });
    try {
      if (transitLevelIndex(level) < 0) return;
      var currentValues = {
        decadal: runtime.decadalPosition, yearly: runtime.yearPosition, monthly: runtime.monthPosition,
        daily: runtime.day, hourly: runtime.timeIndex,
      };
      if (isTransitIncluded(level) && currentValues[level] === Number(value)) {
        // Cancel this level and its descendants without resetting the retained date.
        setTransitLevel(parentTransitLevel(level));
        applyActiveScopeFocus();
        renderFacts(runtime.chart, runtime.horoscope, runtime.input);
        renderInteractiveChart();
        renderScopeTable(runtime.chart, runtime.horoscope);
        renderTransitPicker();
        showStatus('已取消' + SCOPE_DISPLAY_NAMES[level] + '，返回' + SCOPE_DISPLAY_NAMES[runtime.transitLevel] + '盘。', false);
        return;
      }
      if (level === 'decadal') { runtime.decadalPosition = Number(value); resetAfter('decadal'); }
      if (level === 'yearly') { runtime.yearPosition = Number(value); resetAfter('yearly'); }
      if (level === 'monthly') { runtime.monthPosition = Number(value); resetAfter('monthly'); }
      if (level === 'daily') runtime.day = Number(value);
      if (level === 'hourly') runtime.timeIndex = Number(value);
      setTransitLevel(level);
      updateFromSelection();
    } catch (error) {
      runtime = previous;
      byId('target-date').value = runtime.input.targetDate;
      byId('target-time').value = String(runtime.input.targetTime);
      showStatus(error && error.message ? error.message : '无法切换到所选运限，请检查日期范围。', true);
    }
  }

  function yearlyItem(year) {
    var date = lunarDateToSolar(year, { month: 6, isLeapMonth: false }, 1);
    var scope = runtime.chart.horoscope(date, 6).yearly;
    return Object.assign({}, scope, { year: year, age: year - runtime.chart.rawDates.lunarDate.lunarYear + 1 });
  }

  function yearsForDecadal(position, includeYear) {
    var item = runtime.decadals[position];
    var years = item.childhood ? Array.from({ length: item.yearRange[1] - item.yearRange[0] + 1 }, function (_, index) {
      return yearlyItem(item.yearRange[0] + index);
    }) : runtime.chart.yearlyList(item.sourcePosition);
    // Birthday-based age boundaries can retain the previous decade into the next lunar year.
    if (includeYear != null && !years.some(function (year) { return year.year === includeYear; })) years.push(yearlyItem(includeYear));
    return years.sort(function (a, b) { return a.year - b.year; });
  }

  function validateTargetDate(chart, date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || localDateValue(new Date(date + 'T12:00:00')) !== date) throw new Error('请选择有效的公历日期。');
    if (date < normalizeDate(chart.solarDate)) throw new Error('查看日期不能早于出生日期。');
    var lunar = window.iztro.astro.bySolar(date, 6, chart.gender, false, 'zh-CN').rawDates.lunarDate;
    var last = chart.decadalList().slice(-1)[0];
    if (lunar.lunarYear > last.yearRange[1]) throw new Error('查看日期超出本命盘支持的十二个大限范围，未生成推测结果。');
  }

  function initTransitNavigator(chart, input, horoscope) {
    validateTargetDate(chart, input.targetDate);
    var converter = window.iztro.astro.bySolar(input.targetDate, 6, input.gender, input.fixLeap, 'zh-CN');
    var lunar = converter.rawDates.lunarDate;
    runtime.chart = chart;
    runtime.input = input;
    runtime.horoscope = horoscope;
    runtime.timeIndex = input.targetTime;
    setTransitLevel('daily');
    runtime.selectedPalaceIndex = null;
    runtime.relatedIndexes = [];
    runtime.relationRoles = {};
    runtime.dateCache = {};
    runtime.dayMetaCache = {};
    runtime.decadals = chart.decadalList().map(function (item, index) { return Object.assign({}, item, { sourcePosition: index }); });
    var first = runtime.decadals[0];
    if (first.ageRange[0] > 1) runtime.decadals.unshift({ childhood: true, ageRange: [1, first.ageRange[0] - 1],
      yearRange: [chart.rawDates.lunarDate.lunarYear, first.yearRange[0] - 1] });
    runtime.decadalPosition = runtime.decadals.findIndex(function (item) {
      return lunar.lunarYear >= item.yearRange[0] && lunar.lunarYear <= item.yearRange[1];
    });
    if (input.ageDivide === 'birthday') runtime.decadalPosition = runtime.decadals.findIndex(function (item) {
      return horoscope.decadal.name === '童限' ? item.childhood : !item.childhood && item.index === horoscope.decadal.index;
    });
    if (runtime.decadalPosition < 0) throw new Error('所选日期暂无有效的大限或童限，未替换为其他年份。');
    runtime.years = yearsForDecadal(runtime.decadalPosition, lunar.lunarYear);
    runtime.yearPosition = runtime.years.findIndex(function (item) { return item.year === lunar.lunarYear; });
    if (runtime.yearPosition < 0) throw new Error('未找到所选年份，未替换日期。');
    runtime.months = chart.monthlyList(selectedYear().year, input.fixLeap);
    runtime.monthPosition = runtime.months.findIndex(function (item) {
      return item.month === lunar.lunarMonth && item.isLeapMonth === Boolean(lunar.isLeap) &&
        lunar.lunarDay >= item.dayRange[0] && lunar.lunarDay <= item.dayRange[1];
    });
    if (runtime.monthPosition < 0) throw new Error('未找到所选农历月份，未替换日期。');
    runtime.day = Math.min(Math.max(lunar.lunarDay, selectedMonth().dayRange[0]), selectedMonth().dayRange[1]);
    applyActiveScopeFocus();
  }

  function selectPalace(index) {
    runtime.activeScopeLevel = 'manual';
    applyPalaceFocus(index);
    renderInteractiveChart();
  }

  function returnToToday() {
    var previous = Object.assign({}, runtime, { input: Object.assign({}, runtime.input) });
    var now = new Date();
    runtime.input.targetDate = localDateValue(now);
    runtime.input.targetTime = hourToTimeIndex(now.getHours());
    byId('target-date').value = runtime.input.targetDate;
    byId('target-time').value = String(runtime.input.targetTime);
    try {
      runtime.horoscope = runtime.chart.horoscope(runtime.input.targetDate, runtime.input.targetTime);
      initTransitNavigator(runtime.chart, runtime.input, runtime.horoscope);
      renderFacts(runtime.chart, runtime.horoscope, runtime.input);
      renderInteractiveChart();
      renderTransitPicker();
      renderScopeTable(runtime.chart, runtime.horoscope);
      showStatus('已回到今天：' + runtime.horoscope.lunarDate + ' · ' + TIME_OPTIONS[runtime.timeIndex][0] + '。', false);
    } catch (error) {
      runtime = previous;
      byId('target-date').value = runtime.input.targetDate;
      byId('target-time').value = String(runtime.input.targetTime);
      showStatus(error && error.message ? error.message : '当前日期超出可计算范围。', true);
    }
  }

  function showInputPage() {
    setWorkspaceView('input');
    els.inputPage.hidden = false;
    els.result.hidden = true;
    var monthlyPage = byId('monthly-page');
    var yearlyPage = byId('yearly-page');
    var dailyPage = byId('daily-page');
    var systemPage = byId('system-page');
    var reportPage = byId('report-page');
    if (monthlyPage) monthlyPage.hidden = true;
    if (yearlyPage) yearlyPage.hidden = true;
    if (dailyPage) dailyPage.hidden = true;
    if (systemPage) systemPage.hidden = true;
    if (reportPage) reportPage.hidden = true;
    hideStatus();
  }

  function readInput() {
    return {
      type: formValue('calendar-type'),
      birthDate: formValue('birth-date'),
      birthTime: Number(formValue('birth-time')),
      gender: formValue('gender'),
      isLeapMonth: byId('leap-month').checked,
      targetDate: formValue('target-date'),
      targetTime: Number(formValue('target-time')),
      fixLeap: byId('fix-leap').checked,
      algorithm: formValue('algorithm'),
      yearDivide: formValue('year-divide'),
      horoscopeDivide: formValue('horoscope-divide'),
      ageDivide: formValue('age-divide'),
      dayDivide: formValue('day-divide'),
    };
  }

  function validateInput(input) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.birthDate)) throw new Error('请输入完整的出生日期。');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.targetDate)) throw new Error('请输入完整的查看日期。');
  }

  function renderChart(event) {
    if (event) event.preventDefault();
    hideStatus();
    els.result.hidden = true;

    var previous = Object.assign({}, runtime);
    try {
      if (!window.iztro || !window.iztro.astro) throw new Error('排盘引擎未加载。请检查网络后刷新页面。');
      var input = readInput();
      validateInput(input);

      var chart = window.iztro.astro.withOptions({
        type: input.type,
        dateStr: input.birthDate,
        timeIndex: input.birthTime,
        gender: input.gender,
        isLeapMonth: input.type === 'lunar' ? input.isLeapMonth : false,
        fixLeap: input.fixLeap,
        language: 'zh-CN',
        astroType: input.algorithm === 'zhongzhou' ? 'heaven' : undefined,
        config: {
          algorithm: input.algorithm,
          yearDivide: input.yearDivide,
          horoscopeDivide: input.horoscopeDivide,
          ageDivide: input.ageDivide,
          dayDivide: input.dayDivide,
        },
      });
      validateTargetDate(chart, input.targetDate);
      var horoscope = chart.horoscope(input.targetDate, input.targetTime);
      initTransitNavigator(chart, input, horoscope);

      renderFacts(chart, horoscope, input);
      renderInteractiveChart();
      renderTransitPicker();
      renderScopeTable(chart, horoscope);
      renderAuditTable(chart);

      els.inputPage.hidden = true;
      showChartPage();
      return true;
    } catch (error) {
      runtime = previous;
      showStatus(error && error.message ? error.message : '排盘失败，请核对输入。', true);
      return false;
    }
  }

  function toggleLeapMonth() {
    var isLunar = els.calendarType.value === 'lunar';
    els.leapMonthField.classList.toggle('visible', isLunar);
    els.leapMonth.disabled = !isLunar;
    if (!isLunar) els.leapMonth.checked = false;
  }

  function init() {
    els.form = byId('chart-form');
    els.status = byId('status');
    els.result = byId('result');
    els.inputPage = byId('input-page');
    els.calendarType = byId('calendar-type');
    els.leapMonthField = byId('leap-month-field');
    els.leapMonth = byId('leap-month');
    els.factsGrid = byId('facts-grid');
    els.methodLine = byId('method-line');
    els.generatedAt = byId('generated-at');
    els.chartGrid = byId('chart-grid');
    els.mobileRelationMap = byId('mobile-relation-map');
    els.mobileChartToggle = byId('mobile-chart-toggle');
    els.scopeTable = byId('scope-table');
    els.auditTable = byId('audit-table');
    els.selectionSummary = byId('selection-summary');
    els.decadalOptions = byId('decadal-options');
    els.yearlyOptions = byId('yearly-options');
    els.monthlyOptions = byId('monthly-options');
    els.dailyOptions = byId('daily-options');
    els.hourlyOptions = byId('hourly-options');
    els.knowledgeContent = byId('knowledge-content');
    els.knowledgeVersion = byId('knowledge-version');

    var now = new Date();
    byId('birth-date').value = localDateValue(now);
    byId('target-date').value = localDateValue(now);
    fillTimeOptions(byId('birth-time'), 8);
    fillTimeOptions(byId('target-time'), hourToTimeIndex(now.getHours()));
    byId('daily-target-date').value = localDateValue(now);
    fillDailyTimeOptions(byId('daily-time-window'));
    toggleLeapMonth();
    setWorkspaceView('input');

    if (window.ZDSMKnowledge && typeof window.ZDSMKnowledge.load === 'function') {
      runtime.knowledgePromise = window.ZDSMKnowledge.load().then(function (knowledge) {
        runtime.knowledge = knowledge;
        runtime.knowledgeError = '';
        renderKnowledgePanel();
        var reportPage = byId('report-page');
        if (reportPage && !reportPage.hidden && runtime.chart) generateLocalReport();
        return knowledge;
      }).catch(function (error) {
        runtime.knowledgeError = error && error.message ? error.message : '知识库读取失败。';
        renderKnowledgePanel();
        var output = byId('report-output');
        if (output) output.innerHTML = '<p class="report-error">本地知识库载入失败：' + escapeHtml(runtime.knowledgeError) + '</p>';
        return null;
      });
    } else {
      runtime.knowledgeError = '知识库加载器未启用。';
      renderKnowledgePanel();
    }

    els.calendarType.addEventListener('change', toggleLeapMonth);
    els.form.addEventListener('submit', renderChart);
    byId('transit-picker').addEventListener('click', function (event) {
      var option = event.target.closest('[data-level]');
      if (option) changeTransitSelection(option.dataset.level, option.dataset.value);
    });
    byId('today-button').addEventListener('click', returnToToday);
    var backBtn = byId('back-to-input');
    if (backBtn) backBtn.addEventListener('click', showInputPage);
    els.chartGrid.addEventListener('click', function (event) {
      var palace = event.target.closest('[data-palace-index]');
      if (palace) selectPalace(Number(palace.dataset.palaceIndex));
    });
    els.chartGrid.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      var palace = event.target.closest('[data-palace-index]');
      if (palace) {
        event.preventDefault();
        selectPalace(Number(palace.dataset.palaceIndex));
      }
    });
    if (els.mobileRelationMap) els.mobileRelationMap.addEventListener('click', function (event) {
      var palace = event.target.closest('[data-mobile-palace-index]');
      if (palace) selectPalace(Number(palace.dataset.mobilePalaceIndex));
    });
    if (els.mobileChartToggle) els.mobileChartToggle.addEventListener('click', function () {
      var section = els.mobileChartToggle.closest('.chart-section');
      var expanded = section.classList.toggle('mobile-chart-expanded');
      els.mobileChartToggle.setAttribute('aria-expanded', String(expanded));
      els.mobileChartToggle.querySelector('strong').textContent = expanded ? '收起完整十二宫' : '查看完整十二宫';
      els.mobileChartToggle.querySelector('span').textContent = expanded ? '左右滑动查看宫位与四化箭头' : '展开后左右滑动查看宫位与四化箭头';
      if (expanded) window.requestAnimationFrame(renderFlightOverlay);
    });
    window.addEventListener('resize', function () {
      if (!runtime.chart) return;
      ensureTransitSelectionVisible();
      window.requestAnimationFrame(renderFlightOverlay);
    });
  }

  // ===== ZDSM P5 本月运行 =====

  function monthlyPalaceName(scope) {
    if (!scope || !Number.isInteger(scope.index) || !runtime.chart || !runtime.chart.palaces[scope.index]) return '';
    return knowledgePalaceId(runtime.chart.palaces[scope.index].name);
  }

  function transformationsForScope(scope) {
    if (!scope || !Array.isArray(scope.mutagen)) return [];
    return MUTAGEN_LABELS.map(function (type, index) {
      var starName = scope.mutagen[index];
      if (!starName) return null;
      try {
        var target = runtime.chart.star(starName).palace();
        return { star: starName, type: type, target_palace: knowledgePalaceId(target.name) };
      } catch (error) {
        return null;
      }
    }).filter(Boolean);
  }

  function monthlyLayer(scope, source) {
    if (!scope || !Number.isInteger(scope.index)) return null;
    return {
      palace: monthlyPalaceName(scope),
      branch: scope.earthlyBranch || null,
      stem: scope.heavenlyStem || null,
      transformations: transformationsForScope(scope),
      computed_upstream: true,
      childhood: scope.name === '童限',
      source: source,
    };
  }

  function buildMonthlyChartInput() {
    return {
      palaces: (runtime.chart.palaces || []).map(function (palace) {
        return {
          name: knowledgePalaceId(palace.name),
          major_stars: (palace.majorStars || []).map(function (star) {
            return { name: star.name, state: star.brightness || null, natal_transformation: star.mutagen || null };
          }),
          aux_stars: [].concat(palace.minorStars || [], palace.adjectiveStars || []).map(function (star) {
            return { name: star.name, state: star.brightness || null, natal_transformation: star.mutagen || null };
          }),
        };
      }),
    };
  }

  function buildMonthlyRequest() {
    var layers = {
      decade: monthlyLayer(runtime.horoscope.decadal, 'iztro 2.6.1 horoscope.decadal'),
      annual: monthlyLayer(runtime.horoscope.yearly, 'iztro 2.6.1 horoscope.yearly'),
      monthly: monthlyLayer(runtime.horoscope.monthly, 'iztro 2.6.1 horoscope.monthly'),
    };
    var minor = monthlyLayer(runtime.horoscope.age, 'iztro 2.6.1 horoscope.age');
    if (minor) layers.minor_limit = minor;
    return {
      target_month: runtime.input.targetDate.slice(0, 7),
      nominal_age: selectedYear().age,
      calendar_label: selectedYear().year + '年 · ' + monthLabel(selectedMonth()) + '｜公历 ' + runtime.input.targetDate.slice(0, 7),
      report_mode: 'professional',
      time_layers: layers,
      context: { chart_source: 'iztro 2.6.1', knowledge_version: runtime.knowledge ? runtime.knowledge.version : 'P4 Local' },
    };
  }

  function renderMonthlyQuickOptions() {
    var container = byId('monthly-quick-options');
    if (!container || !runtime.months.length) return;
    container.innerHTML = runtime.months.map(function (month, index) {
      return '<button type="button" data-monthly-index="' + index + '" class="monthly-quick-option' +
        (index === runtime.monthPosition ? ' active' : '') + '"><strong>' + escapeHtml(monthLabel(month)) +
        '</strong><span>' + escapeHtml(transitStemBranch(month)) + '</span></button>';
    }).join('');
  }

  function renderMonthlyNetwork(network) {
    var nodes = [
      { className: 'core', label: '流月命宫', data: { palace: network.core, role: network.core_role } },
      { className: 'trine first', label: '三合承接', data: network.trines[0] },
      { className: 'trine second', label: '三合承接', data: network.trines[1] },
      { className: 'opposite', label: '对宫协调', data: network.opposite },
    ];
    byId('monthly-network').innerHTML = '<span class="monthly-network-line vertical"></span><span class="monthly-network-line horizontal"></span>' +
      nodes.map(function (node) {
        return '<article class="monthly-network-node ' + node.className + '"><span>' + node.label + '</span><strong>' +
          escapeHtml(node.data.palace) + '</strong><small>' + escapeHtml(node.data.role) + '</small></article>';
      }).join('');
    byId('monthly-network-label').textContent = network.core + '为入口';
  }

  function renderMonthlyOutput(output) {
    var keyNames = {
      core_focus: '核心宫', opportunity_node: '机会承接',
      bottleneck_node: '最大瓶颈', opposite_tension: '对宫拉扯',
    };
    var keyClasses = { core_focus: 'core', opportunity_node: 'opportunity', bottleneck_node: 'bottleneck', opposite_tension: 'opposite' };
    byId('monthly-title').textContent = output.meta.calendar_label + ' · 本月运行';
    byId('monthly-chain').innerHTML = output.layer_chain.map(function (item, index) {
      return (index ? '<span class="monthly-chain-arrow">→</span>' : '') + '<div><span>' + escapeHtml(item.layer) +
        '</span><strong>' + escapeHtml(item.palace) + '</strong><small>' + escapeHtml(item.role) + '</small></div>';
    }).join('');
    byId('monthly-summary').textContent = output.monthly_summary;
    renderMonthlyNetwork(output.monthly_core_network);
    byId('monthly-key-nodes').innerHTML = Object.keys(keyNames).map(function (key) {
      var item = output.key_nodes[key];
      var reason = Array.isArray(item.reason) ? item.reason.join('；') : item.reason;
      return '<article class="monthly-key-node ' + keyClasses[key] + '"><span>' + keyNames[key] + '</span><strong>' +
        escapeHtml(item.palace) + '</strong><p>' + escapeHtml(item.role) + '</p><small>' + escapeHtml(reason) + '</small></article>';
    }).join('');
    var monthlyTransforms = output.transformations.filter(function (item) { return item.layer === '流月'; });
    byId('monthly-transformations').innerHTML = monthlyTransforms.map(function (item) {
      var key = MUTAGEN_KEYS[MUTAGEN_LABELS.indexOf(item.type)] || '';
      return '<article class="monthly-transform transform-' + key + '"><b>' + escapeHtml(item.type) + '</b><div><strong>' +
        escapeHtml(item.star + ' → ' + item.target_palace) + '</strong><p>' + escapeHtml(item.meaning) + '</p><small>趋势提示，不等于固定事件。</small></div></article>';
    }).join('');
    byId('monthly-resonances').innerHTML = output.resonance_nodes.length ? output.resonance_nodes.map(function (item) {
      return '<article class="monthly-resonance"><div><span>' + escapeHtml(item.level) + '</span><strong>' + escapeHtml(item.palace) +
        '</strong></div><p>' + escapeHtml(item.role) + '</p><small>' + escapeHtml(item.evidence.join(' · ')) + '</small></article>';
    }).join('') : '<p class="monthly-empty">本月没有达到重复激活门槛的节点。</p>';
    byId('monthly-axes').innerHTML = Object.keys(output.axes).map(function (name) {
      var item = output.axes[name];
      return '<article class="monthly-axis relevance-' + escapeHtml(item.relevance) + '"><header><strong>' + escapeHtml(name) +
        '</strong><span>' + escapeHtml(item.relevance) + '</span></header><p>' + escapeHtml(item.summary) + '</p>' +
        (item.evidence.length ? '<small>' + escapeHtml(item.evidence.join(' · ')) + '</small>' : '') + '</article>';
    }).join('');
    byId('monthly-actions').innerHTML = output.monthly_actions.map(function (action) { return '<li>' + escapeHtml(action) + '</li>'; }).join('');
    var contact = (window.ZDSMBundledKnowledge && window.ZDSMBundledKnowledge.contact) || {};
    var channels = usableContactChannels(contact).map(function (channel) {
      return '<li><span>' + escapeHtml(channel.label) + '</span><strong>' + escapeHtml(channel.value) + '</strong></li>';
    }).join('');
    byId('monthly-contact').innerHTML = '<div><span>人工核对</span><h3>' + escapeHtml(contact.contact_title || '对报告还有疑问？') +
      '</h3><p>' + escapeHtml(channels ? contact.contact_text || '联系人工解读。' : '人工咨询渠道尚未配置。') + '</p></div>' + (channels ? '<ul>' + channels + '</ul>' : '');
  }

  function generateMonthlyOutput() {
    var errorBox = byId('monthly-error');
    var content = byId('monthly-content');
    if (!runtime.chart || !runtime.horoscope) return null;
    if (!window.ZDSMMonthlyRuntime) {
      errorBox.hidden = false;
      errorBox.textContent = 'P5 本地月运引擎未载入。';
      content.hidden = true;
      return null;
    }
    try {
      var request = buildMonthlyRequest();
      var output = window.ZDSMMonthlyRuntime.analyze(buildMonthlyChartInput(), request);
      if (output.quality_gate.status !== 'pass') throw new Error('月运质量门未通过：' + output.quality_gate.issues.join('、'));
      errorBox.hidden = true;
      content.hidden = false;
      renderMonthlyOutput(output);
      return output;
    } catch (error) {
      errorBox.hidden = false;
      errorBox.textContent = error && error.message ? error.message : '本月运行生成失败。';
      content.hidden = true;
      return null;
    }
  }

  function showMonthlyPage() {
    if (!runtime.chart) return;
    setWorkspaceView('monthly');
    els.inputPage.hidden = true;
    els.result.hidden = true;
    byId('report-page').hidden = true;
    byId('yearly-page').hidden = true;
    byId('daily-page').hidden = true;
    byId('system-page').hidden = true;
    byId('monthly-page').hidden = false;
    renderMonthlyQuickOptions();
    generateMonthlyOutput();
    window.scrollTo(0, 0);
  }

  function renderYearlyPage() {
    var scope = runtime.horoscope && runtime.horoscope.yearly;
    if (!scope || !Number.isInteger(scope.index)) return;
    var year = selectedYear();
    var surrounded = runtime.chart.surroundedPalaces(scope.index);
    var core = palaceNameAt(runtime.chart, scope.index);
    var relation = [surrounded.wealth, surrounded.career, surrounded.opposite];
    byId('yearly-title').textContent = year.year + '年 · 流年运势';
    byId('yearly-quick-options').innerHTML = runtime.years.map(function (item, index) {
      return '<button type="button" data-yearly-index="' + index + '" class="monthly-quick-option' +
        (index === runtime.yearPosition ? ' active' : '') + '"><strong>' + escapeHtml(item.year + '年') +
        '</strong><span>' + escapeHtml(transitStemBranch(item)) + '</span></button>';
    }).join('');
    byId('yearly-chain').innerHTML = '<div><span>流年入口</span><strong>' + escapeHtml(core) +
      '</strong><small>' + escapeHtml(transitStemBranch(scope)) + '</small></div>' +
      '<span class="monthly-chain-arrow">→</span><div><span>年度任务</span><strong>' +
      escapeHtml(core) + '三方四正</strong><small>承接与协调</small></div>';
    byId('yearly-summary').textContent = '本年重点落在' + core + '，三方四正用于观察年度任务如何承接、转化与协调。';
    byId('yearly-network-label').textContent = core + '为入口';
    byId('yearly-network').innerHTML = [
      { label: '流年入口', name: core, cls: 'core' },
      { label: '三合承接', name: palaceNameAt(runtime.chart, surrounded.wealth.index), cls: 'trine first' },
      { label: '三合承接', name: palaceNameAt(runtime.chart, surrounded.career.index), cls: 'trine second' },
      { label: '对宫协调', name: palaceNameAt(runtime.chart, surrounded.opposite.index), cls: 'opposite' },
    ].map(function (node) {
      return '<article class="monthly-network-node ' + node.cls + '"><span>' + node.label +
        '</span><strong>' + escapeHtml(node.name) + '</strong><small>年度网络节点</small></article>';
    }).join('');
    byId('yearly-transformations').innerHTML = transformationsForScope(scope).map(function (item) {
      var key = MUTAGEN_KEYS[MUTAGEN_LABELS.indexOf(item.type)] || '';
      return '<article class="monthly-transform transform-' + key + '"><b>' + escapeHtml(item.type) +
        '</b><div><strong>' + escapeHtml(item.star + ' → ' + item.target_palace) +
        '</strong><p>本年四化落点，作为年度趋势提示，不等于固定事件。</p></div></article>';
    }).join('');
    var contact = (window.ZDSMBundledKnowledge && window.ZDSMBundledKnowledge.contact) || {};
    var channels = usableContactChannels(contact).map(function (channel) {
      return '<li><span>' + escapeHtml(channel.label) + '</span><strong>' + escapeHtml(channel.value) + '</strong></li>';
    }).join('');
    byId('yearly-contact').innerHTML = '<div><span>人工核对</span><h3>' + escapeHtml(contact.contact_title || '对报告还有疑问？') +
      '</h3><p>' + escapeHtml(channels ? contact.contact_text || '联系人工解读。' : '人工咨询渠道尚未配置。') +
      '</p></div>' + (channels ? '<ul>' + channels + '</ul>' : '');
  }

  function showYearlyPage() {
    if (!runtime.chart) return;
    setWorkspaceView('yearly');
    els.inputPage.hidden = true;
    els.result.hidden = true;
    byId('report-page').hidden = true;
    byId('monthly-page').hidden = true;
    byId('daily-page').hidden = true;
    byId('system-page').hidden = true;
    byId('yearly-page').hidden = false;
    renderYearlyPage();
    window.scrollTo(0, 0);
  }

  function changeYearlyQuick(index) {
    var previous = Object.assign({}, runtime, { input: Object.assign({}, runtime.input) });
    try {
      setTransitLevel('yearly');
      runtime.yearPosition = Number(index);
      resetAfter('yearly');
      updateFromSelection();
      showYearlyPage();
    } catch (error) {
      runtime = previous;
      showStatus(error.message || '流年切换失败。', true);
    }
  }

  function changeMonthlyQuick(index) {
    var previous = Object.assign({}, runtime, { input: Object.assign({}, runtime.input) });
    try {
      setTransitLevel('monthly');
      runtime.monthPosition = Number(index);
      resetAfter('monthly');
      updateFromSelection();
      showMonthlyPage();
    } catch (error) {
      runtime = previous;
      byId('target-date').value = runtime.input.targetDate;
      byId('target-time').value = String(runtime.input.targetTime);
      byId('monthly-error').hidden = false;
      byId('monthly-error').textContent = error.message;
    }
  }

  // ===== ZDSM P6 流日 / 流时运行 =====

  function buildDailyRequest(includeHourly) {
    var layers = {
      decade: monthlyLayer(runtime.horoscope.decadal, 'iztro 2.6.1 horoscope.decadal'),
      annual: monthlyLayer(runtime.horoscope.yearly, 'iztro 2.6.1 horoscope.yearly'),
      monthly: monthlyLayer(runtime.horoscope.monthly, 'iztro 2.6.1 horoscope.monthly'),
      daily: monthlyLayer(runtime.horoscope.daily, 'iztro 2.6.1 horoscope.daily'),
    };
    var minor = monthlyLayer(runtime.horoscope.age, 'iztro 2.6.1 horoscope.age');
    if (minor) layers.minor_limit = minor;
    if (includeHourly) layers.hourly = monthlyLayer(runtime.horoscope.hourly, 'iztro 2.6.1 horoscope.hourly');
    return {
      target_date: runtime.input.targetDate,
      time_window: includeHourly ? TIME_OPTIONS[runtime.timeIndex][0] + ' · ' + TIME_OPTIONS[runtime.timeIndex][1] : null,
      calendar_label: runtime.horoscope.lunarDate + '｜公历 ' + runtime.input.targetDate,
      event_context: byId('daily-event-context').value || 'general',
      time_layers: layers,
      context: { chart_source: 'iztro 2.6.1', knowledge_version: runtime.knowledge ? runtime.knowledge.version : 'P4 Local' },
    };
  }

  function dailyNetworkCard(label, network) {
    if (!network) return '';
    var nodes = [
      { className: 'core', label: '主宫', palace: network.core, role: network.core_role },
      { className: 'trine', label: '三合', palace: network.trines[0].palace, role: network.trines[0].role },
      { className: 'trine', label: '三合', palace: network.trines[1].palace, role: network.trines[1].role },
      { className: 'opposite', label: '对宫', palace: network.opposite.palace, role: network.opposite.role },
    ];
    return '<article class="daily-network-card"><header><span>' + escapeHtml(label) + '</span><strong>' +
      escapeHtml(network.core) + '</strong></header><div>' + nodes.map(function (node) {
        return '<section class="daily-network-node ' + node.className + '"><span>' + node.label + '</span><strong>' +
          escapeHtml(node.palace) + '</strong><small>' + escapeHtml(node.role) + '</small></section>';
      }).join('') + '</div></article>';
  }

  function supportLabel(status) {
    if (status === 'strong_short_term_signal') return '上层强承接';
    if (status === 'supported_short_term_signal') return '有上层承接';
    return '弱短期信号';
  }

  function renderDailyOutput(output) {
    byId('daily-chain').innerHTML = output.layer_chain.map(function (item, index) {
      return (index ? '<span class="daily-chain-arrow">→</span>' : '') + '<div><span>' + escapeHtml(item.layer) +
        '</span><strong>' + escapeHtml(item.palace) + '</strong><small>' + escapeHtml(item.role) + '</small></div>';
    }).join('');
    byId('daily-calendar-label').textContent = output.meta.calendar_label + (output.meta.time_window ? ' · ' + output.meta.time_window : ' · 只分析到流日');
    byId('daily-summary').textContent = output.summary;
    byId('daily-networks').innerHTML = dailyNetworkCard('流月背景', output.networks.monthly) +
      dailyNetworkCard('流日推进', output.networks.daily) + dailyNetworkCard('流时窗口', output.networks.hourly);

    var supportItems = [output.short_term_support.daily, output.short_term_support.hourly].filter(Boolean);
    byId('daily-support').innerHTML = supportItems.map(function (item) {
      return '<article><span>' + escapeHtml(item.layer) + '</span><strong>' + escapeHtml(supportLabel(item.status)) +
        '</strong><p>' + escapeHtml(item.palace) + '</p><small>与上层重合：' +
        escapeHtml(item.overlap_with_upper.join('、') || '无') + '</small></article>';
    }).join('');
    byId('daily-bridges').innerHTML = output.bridge_signals.length ? output.bridge_signals.map(function (item) {
      return '<article><span>' + escapeHtml(item.from_layer + ' → ' + item.to_layer) + '</span><strong>' +
        escapeHtml(item.star + '化' + item.type + ' · ' + item.target_palace) + '</strong><p>' + escapeHtml(item.meaning) + '</p></article>';
    }).join('') : '<p class="monthly-empty">当前层之间没有形成四化桥接。</p>';
    byId('daily-trajectories').innerHTML = output.transformation_trajectories.length ? output.transformation_trajectories.map(function (item) {
      return '<article><header><span>' + escapeHtml(item.star) + '</span><strong>' + escapeHtml(item.sequence) +
        '</strong><em>' + escapeHtml(item.pattern) + '</em></header><p>' + escapeHtml(item.process) +
        '</p><small>' + escapeHtml(item.interpretation) + '</small></article>';
    }).join('') : '<p class="monthly-empty">当前没有同一颗星跨层重复四化。</p>';
    byId('daily-resonances').innerHTML = output.resonance_nodes.map(function (item) {
      return '<article><span>' + escapeHtml(item.level) + '</span><strong>' + escapeHtml(item.palace) +
        '</strong><p>' + escapeHtml(item.role) + '</p><small>' + escapeHtml(item.evidence.join(' · ')) + '</small></article>';
    }).join('');

    var assessment = output.window_assessment;
    byId('daily-assessment-title').textContent = assessment.event_label + ' · ' + assessment.final_focus_palace;
    byId('daily-assessment-role').textContent = assessment.final_focus_role + (assessment.context_network_overlap.length ?
      '｜事情相关宫位命中：' + assessment.context_network_overlap.join('、') : '｜事情相关宫位未直接命中当前四宫网络');
    byId('daily-suitable').innerHTML = assessment.more_suitable_for.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('');
    byId('daily-risks').innerHTML = assessment.watch_out_for.length ? assessment.watch_out_for.map(function (item) {
      return '<li>' + escapeHtml(item) + '</li>';
    }).join('') : '<li>当前窗口没有命中流日／流时化忌或一级共振风险。</li>';
    byId('daily-tactic').textContent = assessment.execution_tactic;

    var contact = (window.ZDSMBundledKnowledge && window.ZDSMBundledKnowledge.contact) || {};
    var channels = usableContactChannels(contact).map(function (channel) {
      return '<li><span>' + escapeHtml(channel.label) + '</span><strong>' + escapeHtml(channel.value) + '</strong></li>';
    }).join('');
    byId('daily-contact').innerHTML = '<div><span>人工核对</span><h3>' + escapeHtml(contact.contact_title || '对报告还有疑问？') +
      '</h3><p>' + escapeHtml(channels ? contact.contact_text || '联系人工解读。' : '人工咨询渠道尚未配置。') + '</p></div>' + (channels ? '<ul>' + channels + '</ul>' : '');
  }

  function updateDailySelection() {
    var date = normalizeDate(byId('daily-target-date').value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('请选择完整的查看日期。');
    var timeValue = byId('daily-time-window').value;
    var includeHourly = timeValue !== '';
    var timeIndex = includeHourly ? Number(timeValue) : 6;
    validateTargetDate(runtime.chart, date);
    runtime.input.targetDate = date;
    runtime.input.targetTime = timeIndex;
    byId('target-date').value = date;
    byId('target-time').value = String(timeIndex);
    var horoscope = runtime.chart.horoscope(date, timeIndex);
    initTransitNavigator(runtime.chart, runtime.input, horoscope);
    setTransitLevel(includeHourly ? 'hourly' : 'daily');
    applyActiveScopeFocus();
    renderFacts(runtime.chart, runtime.horoscope, runtime.input);
    renderInteractiveChart();
    renderTransitPicker();
    renderScopeTable(runtime.chart, runtime.horoscope);
    return includeHourly;
  }

  function generateDailyOutput() {
    var errorBox = byId('daily-error');
    var content = byId('daily-content');
    if (!runtime.chart || !runtime.horoscope) return null;
    if (!window.ZDSMDailyHourlyRuntime) {
      errorBox.hidden = false;
      errorBox.textContent = 'P6 本地流日／流时引擎未载入。';
      content.hidden = true;
      return null;
    }
    var previous = Object.assign({}, runtime, { input: Object.assign({}, runtime.input) });
    try {
      var includeHourly = updateDailySelection();
      var request = buildDailyRequest(includeHourly);
      var output = window.ZDSMDailyHourlyRuntime.analyze(buildMonthlyChartInput(), request);
      if (output.quality_gate.status !== 'pass') throw new Error('短周期质量门未通过：' + output.quality_gate.issues.join('、'));
      errorBox.hidden = true;
      content.hidden = false;
      renderDailyOutput(output);
      return output;
    } catch (error) {
      runtime = previous;
      byId('target-date').value = runtime.input.targetDate;
      byId('target-time').value = String(runtime.input.targetTime);
      errorBox.hidden = false;
      errorBox.textContent = error && error.message ? error.message : '流日／流时分析生成失败。';
      content.hidden = true;
      return null;
    }
  }

  function revealDailyPage() {
    if (!runtime.chart) return;
    setWorkspaceView('daily');
    els.inputPage.hidden = true;
    els.result.hidden = true;
    byId('report-page').hidden = true;
    byId('yearly-page').hidden = true;
    byId('monthly-page').hidden = true;
    byId('system-page').hidden = true;
    byId('daily-page').hidden = false;
  }

  function showDailyPage() {
    if (!runtime.chart) return;
    revealDailyPage();
    byId('daily-target-date').value = runtime.input.targetDate;
    byId('daily-time-window').value = isTransitIncluded('hourly') ? String(runtime.timeIndex) : '';
    generateDailyOutput();
    window.scrollTo(0, 0);
  }

  function showTodayPage() {
    if (!runtime.chart) return;
    revealDailyPage();
    byId('daily-target-date').value = localDateValue(new Date());
    byId('daily-time-window').value = '';
    generateDailyOutput();
    window.scrollTo(0, 0);
  }

  function resetDailyToToday() {
    if (!runtime.chart) return;
    byId('daily-target-date').value = localDateValue(new Date());
    byId('daily-time-window').value = '';
    generateDailyOutput();
  }

  // ===== ZDSM Rule Engine V1.1 本命系统结构 =====

  function systemPalaceName(name) {
    var normalized = knowledgePalaceId(name);
    return normalized === '命宫' ? normalized : normalized.replace(/宫$/, '');
  }

  function systemStarState(value) {
    var state = String(value || '平');
    if (state === '得地') return '得';
    if (state === '不得地') return '不';
    return ['庙', '旺', '得', '利', '平', '不', '陷'].indexOf(state) !== -1 ? state : '平';
  }

  function buildSystemChartInput() {
    var engine = window.ZDSMSystemEngine;
    var profiles = engine.profiles || {};
    var auxiliaryProfiles = profiles.auxiliary || {};
    var maleficProfiles = profiles.malefic || {};
    var houses = {};
    (runtime.chart.palaces || []).forEach(function (palace) {
      var name = systemPalaceName(palace.name);
      var detailStars = [].concat(palace.minorStars || [], palace.adjectiveStars || []);
      houses[name] = {
        main: (palace.majorStars || []).map(function (star) {
          return { name: star.name, state: systemStarState(star.brightness) };
        }),
        aux: detailStars.map(function (star) { return star.name; }).filter(function (star) {
          return Object.prototype.hasOwnProperty.call(auxiliaryProfiles, star);
        }),
        malefic: detailStars.map(function (star) { return star.name; }).filter(function (star) {
          return Object.prototype.hasOwnProperty.call(maleficProfiles, star);
        }),
        transforms: (palace.majorStars || []).filter(function (star) { return Boolean(star.mutagen); }).map(function (star) {
          return { star: star.name, type: '生年' + star.mutagen, dir: null };
        }),
        body: Boolean(palace.isBodyPalace),
      };
    });
    return {
      meta: {
        name: '当前本命盘', gender: runtime.input.gender,
        solar: runtime.input.birthDate + ' ' + TIME_OPTIONS[runtime.input.birthTime][0],
        lunar: runtime.chart.lunarDate || '', bureau: runtime.chart.fiveElementsClass || '',
      },
      houses: houses,
      timing: {
        decade: { palace: systemPalaceName(monthlyPalaceName(runtime.horoscope.decadal)) || null },
        year: { palace: systemPalaceName(monthlyPalaceName(runtime.horoscope.yearly)) || null },
        smallLimit: { palace: systemPalaceName(monthlyPalaceName(runtime.horoscope.age)) || null },
      },
    };
  }

  function systemNode(item, label, extraClass) {
    if (!item) return '';
    var activated = item.activationBonus > 0 ? '<i title="当前大限／流年／小限激活">运限激活</i>' : '';
    return '<article class="system-node ' + (extraClass || '') + '"><span>' + escapeHtml(label) + '</span><strong>' +
      escapeHtml(item.name) + '</strong><small>结构占用 ' + item.strength.toFixed(2) + ' · 摩擦 ' +
      item.friction.toFixed(2) + '</small>' + activated + '</article>';
  }

  function renderSystemOutput(output) {
    var roleCards = [
      ['核心发动机', output.engine, 'drive'], ['中央处理器', output.processor, 'process'],
      ['主要输入', output.inputs[0], 'support'], ['主要输出', output.outputs[0], 'output'],
      ['长期积累', output.storage, 'store'], ['最大瓶颈', output.bottleneck, 'friction'],
      ['恢复节点', output.recovery, 'strength'],
    ];
    var dimensionLabels = { drive: '推动', process: '处理', support: '支持', output: '输出', store: '积累', friction: '摩擦', strength: '占用' };
    byId('system-version').textContent = '规则版本 ' + output.version + ' · 0 API';
    byId('system-summary').textContent = output.summary;
    byId('system-roles').innerHTML = roleCards.filter(function (entry) { return entry[1]; }).map(function (entry) {
      return '<article class="system-role-card role-' + entry[2] + '"><span>' + entry[0] + '</span><strong>' +
        escapeHtml(entry[1].name) + '</strong><small>' + dimensionLabels[entry[2]] + ' ' +
        Number(entry[1][entry[2]] || 0).toFixed(2) + '</small></article>';
    }).join('');

    var inputs = output.inputs.map(function (item, index) { return systemNode(item, index ? '次级入口' : '主要入口', 'input'); }).join('');
    var outputs = output.outputs.map(function (item, index) { return systemNode(item, index ? '次级输出' : '主要输出', 'output'); }).join('');
    byId('system-flow').innerHTML = '<div class="system-flow-stack">' + inputs + '</div><span class="system-flow-arrow">→</span>' +
      systemNode(output.engine, '发动机', 'engine') + '<span class="system-flow-arrow">→</span>' +
      systemNode(output.processor, '处理中枢', 'processor') + '<span class="system-flow-arrow">→</span>' +
      '<div class="system-flow-stack">' + outputs + '</div><span class="system-flow-arrow">→</span>' +
      systemNode(output.storage, '长期积累', 'storage');
    byId('system-growth-loop').textContent = output.growthLoop.join(' → ');
    byId('system-recovery-loop').textContent = output.recoveryLoop.join(' → ');

    var labels = { drive: '推动', process: '处理', output: '输出', store: '积累', support: '支持', friction: '摩擦' };
    byId('system-scores').innerHTML = output.scores.slice().sort(function (a, b) { return b.strength - a.strength; }).map(function (item) {
      var dimensions = Object.keys(labels).map(function (key) {
        return '<span><b>' + labels[key] + '</b><em>' + item[key].toFixed(2) + '</em></span>';
      }).join('');
      return '<article class="system-score' + (item.name === output.bottleneck.name ? ' bottleneck' : '') + '"><header><div><strong>' +
        escapeHtml(item.name) + '</strong><small>' + escapeHtml(item.role) + '</small></div><b>' + item.strength.toFixed(2) +
        '</b></header><div>' + dimensions + '</div>' + (item.activationBonus > 0 ? '<p>当前运限激活 +' +
          item.activationBonus.toFixed(2) + '</p>' : '') + '</article>';
    }).join('');
  }

  function generateSystemOutput() {
    var errorBox = byId('system-error');
    var content = byId('system-content');
    if (!runtime.chart || !runtime.horoscope) return null;
    if (!window.ZDSMSystemEngine) {
      errorBox.hidden = false;
      errorBox.textContent = 'ZDSM V1.1 本地系统规则引擎未载入。';
      content.hidden = true;
      return null;
    }
    try {
      var output = window.ZDSMSystemEngine.analyzeChart(buildSystemChartInput());
      errorBox.hidden = true;
      content.hidden = false;
      renderSystemOutput(output);
      return output;
    } catch (error) {
      errorBox.hidden = false;
      errorBox.textContent = error && error.message ? error.message : '本命系统结构生成失败。';
      content.hidden = true;
      return null;
    }
  }

  function showSystemPage() {
    if (!runtime.chart) return;
    setWorkspaceView('system');
    els.inputPage.hidden = true;
    els.result.hidden = true;
    byId('report-page').hidden = true;
    byId('yearly-page').hidden = true;
    byId('monthly-page').hidden = true;
    byId('daily-page').hidden = true;
    byId('system-page').hidden = false;
    generateSystemOutput();
    window.scrollTo(0, 0);
  }

  // ===== ZDSM 本地规则报告 =====

  var REPORT_SCOPES = {
    full: ['命宫', '兄弟宫', '夫妻宫', '子女宫', '财帛宫', '疾厄宫', '迁移宫', '交友宫', '官禄宫', '田宅宫', '福德宫', '父母宫'],
    body: ['疾厄宫', '福德宫', '命宫'],
    career: ['官禄宫', '命宫', '迁移宫', '父母宫', '交友宫', '子女宫'],
    money: ['财帛宫', '官禄宫', '田宅宫', '夫妻宫'],
    love: ['夫妻宫', '福德宫', '交友宫', '命宫'],
  };
  var REPORT_SCOPE_NAMES = { full: '完整报告', body: '身体', career: '事业', money: '钱', love: '爱情与关系' };
  var REPORT_ACTION_OWNERS = {
    full: null,
    body: ['身体'],
    career: ['事业', '朋友/社群/同行', '父母/亲人/长辈', '晚辈/学生/作品/产品'],
    money: ['钱', '事业', '合作方/客户/上级'],
    love: ['爱情/关系', '朋友/社群/同行', '合作方/客户/上级'],
  };

  function uniqueChartStars(palace) {
    var seen = {};
    return [].concat(palace.majorStars || [], palace.minorStars || [], palace.adjectiveStars || []).filter(function (star) {
      if (!star || !star.name || seen[star.name]) return false;
      seen[star.name] = true;
      return true;
    });
  }

  function localReportSection(palace) {
    var palaceId = knowledgePalaceId(palace.name);
    var palaceRule = runtime.knowledge.palaces[palaceId] || {};
    var allStars = uniqueChartStars(palace);
    var starNames = allStars.map(function (star) { return star.name; });
    var majorNames = (palace.majorStars || []).map(function (star) { return star.name; });
    var omittedRules = [];
    var majorRules = (palace.majorStars || []).map(function (star) {
      var rule = runtime.knowledge.starPalaceRules[star.name + '|' + palaceId];
      var starRule = runtime.knowledge.stars[star.name] || {};
      if (!rule) return null;
      if (rule.source_status === 'model_projection_only' || !rule.source_id) {
        omittedRules.push({ rule_id: rule.rule_id, star: star.name, reason: '无可追溯来源，未进入报告结论' });
        return null;
      }
      var state = templeStateFor(star.name, palace.earthlyBranch);
      return {
        rule_id: rule.rule_id,
        star: star.name,
        chart_state: star.brightness || '',
        table_state: state ? state.state : '',
        core_functions: splitKnowledgeTerms(starRule.core_functions),
        core_effect: rule.modern_core_effect,
        possible_manifestations: parseKnowledgeList(rule.possible_manifestations_json),
        risk_pattern: rule.risk_pattern,
        do_not_infer: parseKnowledgeList(rule.do_not_infer_json),
        evidence_type: rule.evidence_type,
        confidence: rule.confidence,
        source_id: rule.source_id,
        source_status: rule.source_status,
      };
    }).filter(Boolean);

    var auxiliaryRules = allStars.map(function (star) {
      var rule = runtime.knowledge.auxiliaryStars[star.name];
      var detail = runtime.knowledge.minorStars[star.name];
      if (!rule && !detail) return null;
      return {
        star: star.name,
        functions: splitKnowledgeTerms(rule ? rule.modern_functions : detail.modern_functions),
        evidence_type: rule ? rule.evidence_type : detail.evidence_type,
        tier: detail ? 'detail_only' : 'support',
        boundary: detail ? '只作细化，不能覆盖主结构' : '必须结合主星、宫位与四化使用',
      };
    }).filter(Boolean);

    var colocations = runtime.knowledge.colocations.filter(function (rule) {
      return rule.status === 'active' && rule.branch_group.indexOf(palace.earthlyBranch) !== -1 &&
        majorNames.indexOf(rule.star_a) !== -1 && majorNames.indexOf(rule.star_b) !== -1;
    });
    var colocationPairs = colocations.reduce(function (pairs, rule) {
      pairs[[rule.star_a, rule.star_b].sort().join('|')] = true;
      return pairs;
    }, {});
    var interactions = runtime.knowledge.interactions.filter(function (rule) {
      return rule.status === 'active' && starNames.indexOf(rule.star_a) !== -1 && interactionMatches(rule.star_b, starNames);
    }).filter(function (rule) {
      var alternative = String(rule.star_b || '').split('/').find(function (name) { return starNames.indexOf(name) !== -1; });
      return !alternative || !colocationPairs[[rule.star_a, alternative].sort().join('|')];
    });
    var combinations = colocations.concat(interactions).map(function (rule) {
      return {
        rule_id: rule.colocation_id || rule.interaction_id,
        stars: rule.star_a + ' × ' + rule.star_b,
        effect: rule.modern_effect || rule.effects_text,
        confidence: rule.confidence,
        evidence_type: rule.evidence_type || '',
        source_id: rule.source_id || rule.source_ids,
      };
    });

    var transformations = runtime.flightRoutes.filter(function (route) {
      return knowledgePalaceId(route.targetName) === palaceId;
    }).map(function (route) {
      var meaning = runtime.knowledge.transformations[route.mutagen] || {};
      return {
        transformation: route.mutagen,
        star: route.starName,
        source: route.sourceLabel,
        self_transform: route.isSelf,
        meanings: splitKnowledgeTerms(meaning.meanings),
        not_equal_to: meaning.not_equal_to || '固定吉凶',
      };
    });

    var activeLayers = SCOPE_LABELS.filter(function (entry) {
      return isTransitIncluded(entry[1]) && runtime.horoscope && runtime.horoscope[entry[1]] && runtime.horoscope[entry[1]].index === palace.index;
    }).map(function (entry) { return entry[0]; });
    var details = [
      { layer: '长生', name: palace.changsheng12 },
      { layer: '博士', name: palace.boshi12 },
      { layer: '岁前', name: palace.suiqian12 },
      { layer: '将前', name: palace.jiangqian12 },
    ];
    var edges = runtime.knowledge.functionalEdges.filter(function (edge) {
      return edge.source === palaceId || edge.target === palaceId;
    }).map(function (edge) {
      return { source: edge.source, target: edge.target, label: edge.label, evidence_type: edge.evidence_type };
    });

    return {
      palace: palaceId,
      stem_branch: (palace.heavenlyStem || '') + (palace.earthlyBranch || ''),
      system_role: palaceRule.system_role || '',
      inputs: splitKnowledgeTerms(palaceRule.inputs),
      observable_outputs: splitKnowledgeTerms(palaceRule.outputs),
      major_rules: majorRules,
      auxiliary_rules: auxiliaryRules,
      combinations: combinations,
      transformations: transformations,
      active_time_layers: activeLayers,
      detail_markers: details,
      functional_edges: edges,
      omitted_unverified_rules: omittedRules,
    };
  }

  function buildLocalReport(scope, mode) {
    if (!runtime.chart || !runtime.input || !runtime.knowledge) return null;
    var allowed = REPORT_SCOPES[scope] || REPORT_SCOPES.full;
    var sections = (runtime.chart.palaces || []).filter(function (palace) {
      return allowed.indexOf(knowledgePalaceId(palace.name)) !== -1;
    }).map(localReportSection).sort(function (a, b) {
      return allowed.indexOf(a.palace) - allowed.indexOf(b.palace);
    });
    var owners = REPORT_ACTION_OWNERS[scope];
    var actions = runtime.knowledge.actions.filter(function (action) {
      return !owners || owners.indexOf(action.owner_section) !== -1;
    }).map(function (action) {
      return { action_id: action.action_id, owner_section: action.owner_section, text: action.text };
    });
    var sourceAttached = sections.every(function (section) {
      return section.major_rules.every(function (rule) { return Boolean(rule.source_id && rule.confidence); }) &&
        section.combinations.every(function (rule) { return Boolean(rule.source_id && rule.confidence); });
    });
    var ruleCount = sections.reduce(function (total, section) {
      return total + section.major_rules.length + section.auxiliary_rules.length + section.combinations.length +
        section.transformations.length + section.functional_edges.length;
    }, 0);
    return {
      meta: {
        engine: 'ZDSM deterministic local rule engine',
        knowledge_version: runtime.knowledge.version,
        chart_source: 'iztro 2.6.1',
        generated_at: new Date().toISOString(),
        scope: scope,
        scope_name: REPORT_SCOPE_NAMES[scope] || REPORT_SCOPE_NAMES.full,
        evidence_mode: mode,
        remote_request_used: false,
        birth_date: runtime.input.birthDate,
        birth_calendar: runtime.input.type,
        birth_is_leap_month: runtime.input.type === 'lunar' && runtime.input.isLeapMonth,
        birth_solar_date: runtime.chart.solarDate,
        birth_lunar_date: runtime.chart.lunarDate,
        birth_time: TIME_OPTIONS[runtime.input.birthTime][0],
        gender: runtime.input.gender,
        view_date: runtime.input.targetDate,
        view_time: isTransitIncluded('hourly') ? TIME_OPTIONS[runtime.input.targetTime][0] : null,
        lunar_view: isTransitIncluded('daily') ? runtime.horoscope.lunarDate : null,
        transit_level: runtime.transitLevel,
        focus_mode: runtime.activeScopeLevel,
        view_label: transitSelectionText(),
        flight_source: runtime.flightRoutes.length ? runtime.flightRoutes[0].sourceLabel : null,
        selected_palace: runtime.selectedPalaceIndex == null ? null : knowledgePalaceId(runtime.chart.palaces[runtime.selectedPalaceIndex].name),
        calculation_options: { algorithm: runtime.input.algorithm, yearDivide: runtime.input.yearDivide,
          horoscopeDivide: runtime.input.horoscopeDivide, ageDivide: runtime.input.ageDivide,
          dayDivide: runtime.input.dayDivide, fixLeap: runtime.input.fixLeap },
      },
      current_flow: runtime.flightRoutes.map(function (route) {
        return { transformation: route.mutagen, star: route.starName, target: knowledgePalaceId(route.targetName), self_transform: route.isSelf };
      }),
      sections: sections,
      actions: actions,
      quality_gate: {
        status: sourceAttached && sections.length && ruleCount ? 'pass' : 'review',
        checks: [
          { name: '规则附带来源和置信度', pass: sourceAttached },
          { name: '未使用远程接口或模型', pass: true },
          { name: '无来源投射项已排除', pass: true },
          { name: '细化星与短周期不覆盖主结构', pass: true },
          { name: '四化采用命盘引擎当前结果', pass: true },
        ],
      },
      counts: { sections: sections.length, matched_rules: ruleCount, actions: actions.length },
      boundaries: ['不输出固定事件预测', '不把辅煞、小星或流日当作主结论', '不提供医疗、法律、投资或确定性人生判断'],
    };
  }

  function renderReportSection(section, mode) {
    var majors = section.major_rules.length ? section.major_rules.map(function (rule) {
      var details = mode === 'professional' ?
        '<div class="report-evidence"><span>' + escapeHtml(rule.rule_id) + '</span><span>' + escapeHtml(confidenceLabel(rule.confidence)) +
        '</span><span>' + escapeHtml(rule.evidence_type) + '</span><span>' + escapeHtml(rule.source_id) + '</span></div>' +
        (rule.possible_manifestations.length ? '<ul>' + rule.possible_manifestations.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ul>' : '') +
        '<p class="report-risk"><b>风险观察</b>' + escapeHtml(rule.risk_pattern) + '</p>' +
        '<p class="report-boundary"><b>不得推出</b>' + escapeHtml(rule.do_not_infer.join('；')) + '</p>' : '';
      return '<article class="report-finding"><header><strong>' + escapeHtml(rule.star) + '</strong><span>' +
        escapeHtml(rule.chart_state || '状态未标') + (rule.table_state ? ' · 表 ' + escapeHtml(rule.table_state) : '') +
        '</span></header><p>' + escapeHtml(rule.core_effect) + '</p>' + details + '</article>';
    }).join('') : '<p class="report-empty">此宫为空宫，没有主星×宫位命中项。</p>';
    var combinations = section.combinations.map(function (rule) {
      return '<li><strong>' + escapeHtml(rule.stars) + '</strong><span>' + escapeHtml(rule.effect) + '</span>' +
        (mode === 'professional' ? '<small>' + escapeHtml(rule.rule_id + ' · ' + confidenceLabel(rule.confidence) + ' · ' + rule.source_id) + '</small>' : '') + '</li>';
    }).join('');
    var aux = section.auxiliary_rules.map(function (rule) {
      return '<span class="report-chip ' + (rule.tier === 'detail_only' ? 'detail' : '') + '" title="' + escapeHtml(rule.boundary) + '">' +
        escapeHtml(rule.star + '｜' + rule.functions.join(' · ')) + '</span>';
    }).join('');
    var transformations = section.transformations.map(function (item) {
      return '<li class="report-transform"><b>' + escapeHtml(item.transformation) + '</b><span>' + escapeHtml(item.star + ' → ' + section.palace + (item.self_transform ? '（自化）' : '')) +
        '</span><small>' + escapeHtml(item.meanings.join(' · ')) + '；不等于：' + escapeHtml(item.not_equal_to) + '</small></li>';
    }).join('');
    var edges = section.functional_edges.map(function (edge) {
      return '<li><span>' + escapeHtml(edge.source + ' → ' + edge.target) + '</span><strong>' + escapeHtml(edge.label) + '</strong></li>';
    }).join('');
    var omitted = section.omitted_unverified_rules.length ? '<p class="report-omitted">未采用：' + section.omitted_unverified_rules.map(function (rule) {
      return escapeHtml(rule.rule_id + ' ' + rule.star + '（' + rule.reason + '）');
    }).join('；') + '</p>' : '';
    return '<details class="report-section disclosure"><summary class="report-section-summary"><strong>' +
      escapeHtml(section.palace) + '</strong><span>' + escapeHtml(section.system_role) + '</span></summary><div class="disclosure-body">' +
      '<div class="report-role"><span>输入：' + escapeHtml(section.inputs.join(' · ') || '—') + '</span><span>观察输出：' +
      escapeHtml(section.observable_outputs.join(' · ') || '—') + '</span></div>' + omitted + '<div class="report-findings">' + majors + '</div>' +
      (combinations ? '<div class="report-subblock"><h4>组合命中</h4><ul class="report-combinations">' + combinations + '</ul></div>' : '') +
      (aux ? '<div class="report-subblock"><h4>辅煞与细化星</h4><div class="report-chips">' + aux + '</div><small>细化星只作补充，不能覆盖主结构。</small></div>' : '') +
      (transformations ? '<div class="report-subblock"><h4>当前四化落点</h4><ul class="report-transformations">' + transformations + '</ul></div>' : '') +
      '<div class="report-section-foot"><span>激活时间层：' + escapeHtml(section.active_time_layers.join(' · ') || '无') + '</span>' +
      (edges ? '<ul class="report-edges">' + edges + '</ul>' : '<span>当前无收录功能边</span>') + '</div></div></details>';
  }

  function renderLocalReport(report) {
    var output = byId('report-output');
    if (!output) return;
    var checks = report.quality_gate.checks.map(function (check) {
      return '<li class="' + (check.pass ? 'pass' : 'review') + '"><span>' + (check.pass ? '✓' : '!') + '</span>' + escapeHtml(check.name) + '</li>';
    }).join('');
    var actions = report.actions.map(function (action) {
      return '<li><span>' + escapeHtml(action.owner_section) + '</span><p>' + escapeHtml(action.text) + '</p><small>' + escapeHtml(action.action_id) + '</small></li>';
    }).join('');
    output.innerHTML = '<div class="report-summary"><div><span>本地命中</span><strong>' + report.counts.matched_rules + '</strong><small>条规则 / ' +
      report.counts.sections + ' 个宫位</small></div><div><span>查看范围</span><strong>' + escapeHtml(report.meta.scope_name) + '</strong><small>' +
      escapeHtml(report.meta.view_label) + '</small></div><div><span>规则完整性检查</span><strong class="gate-' +
      report.quality_gate.status + '">' + (report.quality_gate.status === 'pass' ? '通过' : '复核') + '</strong><small>' +
      escapeHtml(report.meta.knowledge_version) + '</small></div></div>' +
      '<div class="quality-strip"><ul>' + checks + '</ul><p>检查通过不代表预测准确率。相同命盘、日期、层级和所选宫位得到相同规则结果。</p></div>' +
      '<div class="report-sections">' + report.sections.map(function (section) { return renderReportSection(section, report.meta.evidence_mode); }).join('') + '</div>' +
      (actions ? '<section class="report-actions-db"><header><span>数据库行动库</span><h3>可执行建议</h3></header><ul>' + actions + '</ul></section>' : '') +
      '<div class="report-boundaries"><strong>解释边界</strong><span>' + escapeHtml(report.boundaries.join(' · ')) + '</span></div>';
  }

  function generateLocalReport() {
    var output = byId('report-output');
    if (!runtime.chart) {
      if (output) output.innerHTML = '<p class="report-error">请先生成命盘。</p>';
      return null;
    }
    if (!runtime.knowledge) {
      if (runtime.knowledgeError) {
        if (output) output.innerHTML = '<p class="report-error">本地知识库载入失败：' + escapeHtml(runtime.knowledgeError) + '</p>';
      } else {
        if (output) output.innerHTML = '<p class="report-loading">正在读取随页面附带的本地规则包，完成后会自动生成报告。</p>';
        if (runtime.knowledgePromise) runtime.knowledgePromise.then(function () {
          var reportPage = byId('report-page');
          if (reportPage && !reportPage.hidden && runtime.chart) generateLocalReport();
        }).catch(function () {});
      }
      return null;
    }
    var report = buildLocalReport(byId('report-scope').value, byId('report-mode').value);
    runtime.localReport = report;
    renderLocalReport(report);
    return report;
  }

  function exportLocalReport() {
    var report = generateLocalReport();
    if (!report) return;
    var blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'zdsm_local_rule_report_' + runtime.input.targetDate + '.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  function showReportPage() {
    if (!runtime.chart) return;
    setWorkspaceView('report');
    els.inputPage.hidden = true;
    byId('result').hidden = true;
    byId('monthly-page').hidden = true;
    byId('yearly-page').hidden = true;
    byId('daily-page').hidden = true;
    byId('system-page').hidden = true;
    byId('report-page').hidden = false;
    generateLocalReport();
    window.scrollTo(0, 0);
  }

  function showChartPage() {
    if (!runtime.chart) return;
    setWorkspaceView('chart');
    els.inputPage.hidden = true;
    byId('report-page').hidden = true;
    byId('yearly-page').hidden = true;
    byId('monthly-page').hidden = true;
    byId('daily-page').hidden = true;
    byId('system-page').hidden = true;
    byId('result').hidden = false;
    ensureTransitSelectionVisible();
    window.requestAnimationFrame(renderFlightOverlay);
    window.scrollTo(0, 0);
  }

  function bindReportEvents() {
    byId('goto-chart').addEventListener('click', showChartPage);
    var gotoYearly = byId('goto-yearly');
    if (gotoYearly) gotoYearly.addEventListener('click', showYearlyPage);
    byId('reading-system').addEventListener('click', showSystemPage);
    var gotoMonthly = byId('goto-monthly');
    if (gotoMonthly) gotoMonthly.addEventListener('click', showMonthlyPage);
    var gotoToday = byId('goto-today');
    if (gotoToday) gotoToday.addEventListener('click', showTodayPage);
    var gotoDaily = byId('goto-daily');
    if (gotoDaily) gotoDaily.addEventListener('click', showDailyPage);
    var gotoSystem = byId('goto-system');
    if (gotoSystem) gotoSystem.addEventListener('click', showReportPage);
    var gotoReport = byId('goto-report');
    if (gotoReport) gotoReport.addEventListener('click', showReportPage);
    var backChart = byId('back-to-chart');
    if (backChart) backChart.addEventListener('click', showChartPage);
    var generateButton = byId('btn-generate-report');
    if (generateButton) generateButton.addEventListener('click', generateLocalReport);
    var exportButton = byId('btn-export-report');
    if (exportButton) exportButton.addEventListener('click', exportLocalReport);
    var scope = byId('report-scope');
    if (scope) scope.addEventListener('change', generateLocalReport);
    var mode = byId('report-mode');
    if (mode) mode.addEventListener('change', generateLocalReport);
    var monthlyBackInput = byId('monthly-back-input');
    if (monthlyBackInput) monthlyBackInput.addEventListener('click', showInputPage);
    var monthlyToChart = byId('monthly-to-chart');
    if (monthlyToChart) monthlyToChart.addEventListener('click', showChartPage);
    var monthlyToToday = byId('monthly-to-today');
    if (monthlyToToday) monthlyToToday.addEventListener('click', showTodayPage);
    var monthlyToDaily = byId('monthly-to-daily');
    if (monthlyToDaily) monthlyToDaily.addEventListener('click', showDailyPage);
    var monthlyToSystem = byId('monthly-to-system');
    if (monthlyToSystem) monthlyToSystem.addEventListener('click', showSystemPage);
    var monthlyToReport = byId('monthly-to-report');
    if (monthlyToReport) monthlyToReport.addEventListener('click', showReportPage);
    var monthlyQuickOptions = byId('monthly-quick-options');
    if (monthlyQuickOptions) monthlyQuickOptions.addEventListener('click', function (event) {
      var option = event.target.closest('[data-monthly-index]');
      if (option) changeMonthlyQuick(option.dataset.monthlyIndex);
    });
    var yearlyQuickOptions = byId('yearly-quick-options');
    if (yearlyQuickOptions) yearlyQuickOptions.addEventListener('click', function (event) {
      var option = event.target.closest('[data-yearly-index]');
      if (option) changeYearlyQuick(option.dataset.yearlyIndex);
    });
    var dailyBackInput = byId('daily-back-input');
    if (dailyBackInput) dailyBackInput.addEventListener('click', showInputPage);
    var dailyToMonthly = byId('daily-to-monthly');
    if (dailyToMonthly) dailyToMonthly.addEventListener('click', showMonthlyPage);
    var dailyToChart = byId('daily-to-chart');
    if (dailyToChart) dailyToChart.addEventListener('click', showChartPage);
    var dailyToSystem = byId('daily-to-system');
    if (dailyToSystem) dailyToSystem.addEventListener('click', showSystemPage);
    var dailyGenerate = byId('daily-generate');
    if (dailyGenerate) dailyGenerate.addEventListener('click', generateDailyOutput);
    var dailyToday = byId('daily-today');
    if (dailyToday) dailyToday.addEventListener('click', resetDailyToToday);
    var dailyContext = byId('daily-event-context');
    if (dailyContext) dailyContext.addEventListener('change', generateDailyOutput);
    var systemBackInput = byId('system-back-input');
    if (systemBackInput) systemBackInput.addEventListener('click', showInputPage);
    var systemToMonthly = byId('system-to-monthly');
    if (systemToMonthly) systemToMonthly.addEventListener('click', showMonthlyPage);
    var systemToDaily = byId('system-to-daily');
    if (systemToDaily) systemToDaily.addEventListener('click', showDailyPage);
    var systemToChart = byId('system-to-chart');
    if (systemToChart) systemToChart.addEventListener('click', showChartPage);
  }

  var INPUT_FIELDS = { type: 'calendar-type', birthDate: 'birth-date', birthTime: 'birth-time', gender: 'gender',
    isLeapMonth: 'leap-month', targetDate: 'target-date', targetTime: 'target-time', fixLeap: 'fix-leap',
    algorithm: 'algorithm', yearDivide: 'year-divide', horoscopeDivide: 'horoscope-divide', ageDivide: 'age-divide', dayDivide: 'day-divide' };

  function workspaceSnapshot() {
    if (!runtime.chart) return null;
    return { version: 1, input: Object.assign({}, runtime.input), transitLevel: runtime.transitLevel,
      focus: runtime.activeScopeLevel, palaceIndex: runtime.selectedPalaceIndex, view: document.body.dataset.view,
      eventContext: byId('daily-event-context').value, reportScope: byId('report-scope').value, reportMode: byId('report-mode').value };
  }

  function validateSnapshot(snapshot) {
    if (!snapshot || snapshot.version !== 1 || !snapshot.input) throw new Error('不是有效的命例备份。');
    validateInput(snapshot.input);
    Object.keys(INPUT_FIELDS).forEach(function (key) {
      var field = byId(INPUT_FIELDS[key]);
      var value = snapshot.input[key];
      if (field.type === 'checkbox' && typeof value !== 'boolean') throw new Error('命例开关值无效：' + key);
      if (field.tagName === 'SELECT' && !Array.from(field.options).some(function (option) { return option.value === String(value); })) throw new Error('命例选项无效：' + key);
    });
    if (snapshot.transitLevel !== 'natal' && transitLevelIndex(snapshot.transitLevel) < 0) throw new Error('命例运限层级无效。');
    if (snapshot.focus !== 'manual' && snapshot.focus !== snapshot.transitLevel) throw new Error('命例焦点层级无效。');
    if (snapshot.focus === 'manual' && (!Number.isInteger(snapshot.palaceIndex) || snapshot.palaceIndex < 0 || snapshot.palaceIndex > 11)) throw new Error('命例宫位无效。');
    [['eventContext', 'daily-event-context'], ['reportScope', 'report-scope'], ['reportMode', 'report-mode']].forEach(function (item) {
      if (!Array.from(byId(item[1]).options).some(function (option) { return option.value === snapshot[item[0]]; })) throw new Error('命例分析选项无效。');
    });
  }

  function restoreSnapshot(snapshot) {
    validateSnapshot(snapshot);
    Object.keys(INPUT_FIELDS).forEach(function (key) {
      var field = byId(INPUT_FIELDS[key]);
      if (field.type === 'checkbox') field.checked = snapshot.input[key];
      else field.value = String(snapshot.input[key]);
    });
    toggleLeapMonth();
    if (!renderChart()) throw new Error(els.status.textContent || '命例无法排盘。');
    setTransitLevel(snapshot.transitLevel);
    if (snapshot.focus === 'manual') {
      runtime.activeScopeLevel = 'manual';
      applyPalaceFocus(snapshot.palaceIndex);
    } else applyActiveScopeFocus();
    byId('daily-event-context').value = snapshot.eventContext;
    byId('report-scope').value = snapshot.reportScope;
    byId('report-mode').value = snapshot.reportMode;
    renderFacts(runtime.chart, runtime.horoscope, runtime.input);
    renderInteractiveChart(); renderTransitPicker(); renderScopeTable(runtime.chart, runtime.horoscope);
    if (snapshot.view === 'monthly') showMonthlyPage();
    else if (snapshot.view === 'daily') showDailyPage();
    else if (snapshot.view === 'yearly') showYearlyPage();
    else if (snapshot.view === 'system') showSystemPage();
    else if (snapshot.view === 'report') showReportPage();
    else showChartPage();
  }

  function chartExportData() {
    if (!runtime.chart) throw new Error('请先生成命盘。');
    var scope = runtime.horoscope[runtime.transitLevel];
    return { title: '紫微时域 · ' + transitSelectionText(), date: runtime.input.targetDate,
      profile: [runtime.chart.gender, '公历 ' + runtime.chart.solarDate, '农历 ' + runtime.chart.lunarDate,
        '出生时辰 ' + runtime.chart.time, runtime.chart.fiveElementsClass,
        '命宫 ' + runtime.chart.earthlyBranchOfSoulPalace + ' · 身宫 ' + runtime.chart.earthlyBranchOfBodyPalace,
        '命主 ' + runtime.chart.soul + ' · 身主 ' + runtime.chart.body],
      method: els.methodLine.textContent, focus: runtime.selectedPalaceIndex,
      relations: runtime.relationRoles, flights: runtime.flightRoutes,
      palaces: runtime.chart.palaces.map(function (palace) { return {
        name: palace.name, position: PALACE_POSITIONS[palace.index], index: palace.index,
        stem: palace.heavenlyStem + palace.earthlyBranch, ages: palace.decadal.range.join('–'),
        stars: palace.majorStars.concat(palace.minorStars).map(function (star) {
          return star.name + (star.brightness ? '(' + star.brightness + ')' : '') + (star.mutagen ? ' 生年' + star.mutagen : '');
        }),
        adjectives: palace.adjectiveStars.map(function (star) { return star.name; }),
        scope: scope ? scopeDisplayName(runtime.transitLevel) + ' · ' + scope.palaceNames[palace.index] : '',
        transitStars: scope && scope.stars && scope.stars[palace.index] ? scope.stars[palace.index].map(function (star) { return star.name; }) : [],
        markers: [palace.isBodyPalace ? '身宫' : '', palace.isOriginalPalace ? '来因宫' : ''].filter(Boolean),
      }; }),
    };
  }

  function mountWorkspace() {
    if (window.ZDSMWorkspace) window.ZDSMWorkspace.mount({ snapshot: workspaceSnapshot, restore: restoreSnapshot,
      validate: validateSnapshot, chartData: chartExportData, redraw: renderFlightOverlay });
  }

  // 首次访问只显示输入表单；用户主动勾选记住进度后才恢复本机命盘。
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(); bindReportEvents(); mountWorkspace(); });
  } else {
    init();
    bindReportEvents();
    mountWorkspace();
  }
})();
