(function () {
  'use strict';

  var BASE = './knowledge-base/';
  var CSV_FILES = [
    'stars', 'palaces', 'auxiliary_star_functions', 'interaction_operators',
    'star_interactions', 'temple_states', 'transformations', 'source_audit', 'sources',
    'star_palace_rules', 'main_star_colocations', 'main_star_pair_matrix',
    'minor_star_catalog', 'functional_edges', 'changsheng_12', 'boshi_12',
    'taisui_12', 'year_branch_14', 'conclusion_ownership_policy', 'action_library',
  ];

  function parseCsv(text) {
    var rows = [];
    var row = [];
    var field = '';
    var quoted = false;
    var input = String(text || '').replace(/^\uFEFF/, '');

    for (var index = 0; index < input.length; index += 1) {
      var character = input[index];
      if (quoted) {
        if (character === '"' && input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else if (character === '"') {
          quoted = false;
        } else {
          field += character;
        }
      } else if (character === '"') {
        quoted = true;
      } else if (character === ',') {
        row.push(field);
        field = '';
      } else if (character === '\n') {
        row.push(field.replace(/\r$/, ''));
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += character;
      }
    }

    if (field || row.length) {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
    }
    if (!rows.length) return [];

    var headers = rows.shift();
    return rows.filter(function (values) {
      return values.some(function (value) { return value !== ''; });
    }).map(function (values) {
      var record = {};
      headers.forEach(function (header, headerIndex) {
        record[header] = values[headerIndex] == null ? '' : values[headerIndex];
      });
      return record;
    });
  }

  function loadText(path) {
    return fetch(BASE + path).then(function (response) {
      if (!response.ok) throw new Error('知识库文件加载失败：' + path);
      return response.text();
    });
  }

  function loadJson(path) {
    return fetch(BASE + path).then(function (response) {
      if (!response.ok) throw new Error('知识库状态加载失败：' + path);
      return response.json();
    });
  }

  function indexBy(rows, key) {
    return rows.reduce(function (index, row) {
      index[row[key]] = row;
      return index;
    }, {});
  }

  function indexByComposite(rows, keys) {
    return rows.reduce(function (index, row) {
      index[keys.map(function (key) { return row[key]; }).join('|')] = row;
      return index;
    }, {});
  }

  function assembleKnowledge(tables, stages, manifest) {
    return {
      version: stages[4].version,
      stages: { p0: stages[0], p1: stages[1], p2: stages[2], p3: stages[3], p4: stages[4] },
      counts: stages[0].counts,
      recommendations: stages[0].default_recommendations,
      manifest: manifest,
      stars: indexBy(tables.stars, 'star_id'),
      palaces: indexBy(tables.palaces, 'palace_id'),
      auxiliaryStars: indexBy(tables.auxiliary_star_functions, 'star_id'),
      minorStars: indexBy(tables.minor_star_catalog, 'star_id'),
      operators: indexBy(tables.interaction_operators, 'operator_id'),
      interactions: tables.star_interactions,
      starPalaceRules: indexByComposite(tables.star_palace_rules, ['star_id', 'palace_id']),
      colocations: tables.main_star_colocations,
      pairMatrix: indexByComposite(tables.main_star_pair_matrix, ['star_a', 'star_b']),
      functionalEdges: tables.functional_edges,
      templeStates: tables.temple_states,
      changsheng: indexBy(tables.changsheng_12, 'name'),
      boshi: indexBy(tables.boshi_12, 'name'),
      taisui: indexBy(tables.taisui_12, 'name'),
      yearBranchStars: indexBy(tables.year_branch_14, 'name'),
      transformations: indexBy(tables.transformations, 'transformation'),
      ownershipPolicies: tables.conclusion_ownership_policy,
      actions: tables.action_library,
      audits: tables.source_audit,
      sources: indexBy(tables.sources, 'source_id'),
    };
  }

  function loadBundledKnowledge(bundle) {
    var tables = {};
    CSV_FILES.forEach(function (name) {
      if (typeof bundle.csv[name] !== 'string') throw new Error('本地规则包缺少数据表：' + name);
      tables[name] = parseCsv(bundle.csv[name]);
    });
    return assembleKnowledge(tables, bundle.stages, bundle.manifest);
  }

  var loadingPromise = null;
  window.ZDSMKnowledge = {
    load: function () {
      if (loadingPromise) return loadingPromise;
      if (window.ZDSMBundledKnowledge) {
        loadingPromise = Promise.resolve().then(function () {
          return loadBundledKnowledge(window.ZDSMBundledKnowledge);
        });
        return loadingPromise;
      }
      loadingPromise = Promise.all([
        Promise.all(CSV_FILES.map(function (name) {
          return loadText('data/' + name + '.csv').then(parseCsv);
        })),
        Promise.all(['P0_STATUS.json', 'P1_STATUS.json', 'P2_STATUS.json', 'P3_STATUS.json', 'P4_STATUS.json'].map(loadJson)),
        loadJson('manifest.json'),
      ]).then(function (loaded) {
        var tables = {};
        CSV_FILES.forEach(function (name, index) { tables[name] = loaded[0][index]; });
        return assembleKnowledge(tables, loaded[1], loaded[2]);
      });
      return loadingPromise;
    },
  };
})();
