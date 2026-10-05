(function () {
  'use strict';

  var KEY = 'zdsm.core-chart.workspace.v1';
  var state = { version: 1, remember: false, last: null, cases: [] };
  var adapter = null;
  var restoring = false;
  var writable = true;
  var pending = null;
  var printDetails = [];
  var printing = false;
  function el(id) { return document.getElementById(id); }
  function message(text) { el('local-tools-status').textContent = text; }
  function write() {
    if (!writable) throw new Error('本地记录不可读，未覆盖已有数据。请先备份或检查浏览器存储权限。');
    localStorage.setItem(KEY, JSON.stringify(state));
  }
  function refresh() {
    var previous = el('saved-cases').value;
    el('saved-cases').replaceChildren();
    if (!state.cases.length) el('saved-cases').add(new Option('暂无命例', ''));
    state.cases.forEach(function (item) { el('saved-cases').add(new Option(item.name, item.id)); });
    if (state.cases.some(function (item) { return item.id === previous; })) el('saved-cases').value = previous;
    el('remember-progress').checked = state.remember;
    el('load-case').disabled = el('delete-case').disabled = !state.cases.length;
    document.querySelectorAll('.requires-chart').forEach(function (button) { button.disabled = !adapter.snapshot(); });
  }
  function safe(action) {
    return function () {
      try { return action.apply(null, arguments); }
      catch (error) { message(error.message || '操作未完成，请检查浏览器权限。'); }
    };
  }
  function id() { return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10); }
  function restore(snapshot) {
    restoring = true;
    try { adapter.restore(snapshot); }
    finally { restoring = false; refresh(); }
    remember();
  }
  function remember() {
    if (!adapter || restoring) return;
    clearTimeout(pending);
    pending = setTimeout(safe(function () {
      refresh();
      if (state.remember) {
        var snapshot = adapter.snapshot();
        if (snapshot) { state.last = snapshot; write(); }
      }
    }), 0);
  }
  function download(blob, filename) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url; link.download = filename;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function preparePrint() {
    if (printing) return;
    printing = true;
    if (adapter && adapter.snapshot()) {
      var data = adapter.chartData();
      el('print-context').textContent = '紫微时域 · 出生资料：' + data.profile.slice(0, 4).join(' · ') + '\n' + data.method;
    }
    printDetails = Array.from(document.querySelectorAll('main > section:not(#result):not([hidden]) details:not([open])'));
    printDetails.forEach(function (details) { details.open = true; });
    if (adapter && adapter.redraw) adapter.redraw();
  }
  function finishPrint() {
    printDetails.forEach(function (details) { details.open = false; });
    printDetails = [];
    printing = false;
    if (adapter && adapter.redraw) window.requestAnimationFrame(adapter.redraw);
  }

  function exportPng() {
    var data = adapter.chartData();
    var canvas = document.createElement('canvas');
    var cellW = 440, cellH = 520, left = 40, top = 110;
    canvas.width = cellW * 4 + left * 2;
    canvas.height = cellH * 4 + top + 130;
    var ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('此浏览器不支持图片导出，请使用打印 / PDF。');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textBaseline = 'top';
    function text(value, x, y, size, color, bold) {
      ctx.font = (bold ? '600 ' : '') + size + 'px "Microsoft YaHei", sans-serif';
      ctx.fillStyle = color || '#263445'; ctx.fillText(String(value), x, y);
    }
    function wrap(value, x, y, width, size, color) {
      ctx.font = size + 'px "Microsoft YaHei", sans-serif';
      var line = '', offset = 0;
      Array.from(String(value)).forEach(function (char) {
        if (line && ctx.measureText(line + char).width > width) {
          text(line, x, y + offset, size, color); offset += size + 8; line = '';
        }
        line += char;
      });
      if (line) { text(line, x, y + offset, size, color); offset += size + 8; }
      return offset;
    }
    text(data.title, left, 25, 32, '#25425f', true);
    text('查看日期 ' + data.date + ' · 本地排盘信息图', left, 70, 20, '#637184');
    data.palaces.forEach(function (palace) {
      var x = left + (palace.position[1] - 1) * cellW;
      var y = top + (palace.position[0] - 1) * cellH;
      var color = palace.index === data.focus ? '#b8d7f3' :
        palace.index === data.relations.opposite ? '#dceafa' :
        palace.index === data.relations.wealth || palace.index === data.relations.career ? '#edf4fc' : '#ffffff';
      ctx.fillStyle = color; ctx.fillRect(x, y, cellW, cellH);
      ctx.strokeStyle = '#bbc7d4'; ctx.lineWidth = 2; ctx.strokeRect(x, y, cellW, cellH);
      var cursor = y + 20;
      cursor += wrap(palace.stars.join('、') || '空宫', x + 18, cursor, cellW - 36, 23, '#354d69') + 10;
      cursor += wrap(palace.adjectives.join('、'), x + 18, cursor, cellW - 36, 20, '#637184') + 12;
      if (palace.scope) {
        cursor += wrap(palace.scope, x + 18, cursor, cellW - 36, 22, '#145d9f');
        cursor += wrap(palace.transitStars.join('、') || '无流曜', x + 18, cursor, cellW - 36, 19, '#637184') + 10;
      }
      data.flights.filter(function (route) { return route.targetIndex === palace.index; }).forEach(function (route) {
        cursor += wrap(route.mutagen + ' · ' + route.starName + (route.isSelf ? '（宫干自化）' : ''), x + 18, cursor, cellW - 36, 20,
          { lu: '#287b71', quan: '#7138a7', ke: '#2675bf', ji: '#b8414c' }[route.key]);
      });
      if (cursor > y + cellH - 76) throw new Error('当前宫位内容较多，图片排版空间不足；请改用打印 / PDF，避免截断数据。');
      text(palace.name + (palace.index === data.focus ? ' · 主宫' : ''), x + 18, y + cellH - 68, 26, '#25425f', true);
      text(palace.ages + '岁 · ' + palace.stem + (palace.markers.length ? ' · ' + palace.markers.join(' / ') : ''), x + 18, y + cellH - 30, 19, '#637184');
    });
    var cx = left + cellW + 35, cy = top + cellH + 45;
    text('出生资料', cx, cy, 28, '#25425f', true); cy += 52;
    data.profile.forEach(function (line) { cy += wrap(line, cx, cy, cellW * 2 - 70, 25, '#354d69') + 12; });
    cy += 20;
    if (data.flights.length) {
      text(data.flights[0].sourceLabel + '四化飞入', cx, cy, 27, '#25425f', true); cy += 48;
      data.flights.forEach(function (route) {
        cy += wrap(route.mutagen + ' · ' + route.starName + ' → ' + route.targetName + (route.isSelf ? '（宫干自化）' : ''), cx, cy, cellW * 2 - 70, 24, '#354d69') + 10;
      });
    } else text('本命四化见各宫星曜旁的“生年”标记。', cx, cy, 23, '#637184');
    wrap(data.method, left, top + cellH * 4 + 20, cellW * 4, 19, '#637184');
    text('iztro 2.6.1 · 确定性排盘与规则匹配，不代表预测准确率。', left, canvas.height - 38, 19, '#637184');
    canvas.toBlob(function (blob) {
      if (!blob) { message('图片生成失败，请使用打印 / PDF。'); return; }
      download(blob, '紫微命盘_' + data.date + '.png');
      message('已生成命盘图片；请在浏览器下载中查看。');
    }, 'image/png');
  }

  function mount(callbacks) {
    adapter = callbacks;
    el('toggle-tools').addEventListener('click', function () {
      el('local-tools').hidden = !el('local-tools').hidden;
      el('toggle-tools').setAttribute('aria-expanded', String(!el('local-tools').hidden));
    });
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        if (saved.version !== 1 || !Array.isArray(saved.cases) || saved.cases.length > 100) throw new Error('本地命例数据格式无效。');
        saved.cases.forEach(function (item) {
          if (!item || typeof item.id !== 'string' || typeof item.name !== 'string') throw new Error('本地命例记录无效。');
          adapter.validate(item.snapshot);
        });
        if (saved.last) adapter.validate(saved.last);
        state = saved;
      }
    } catch (error) { writable = false; message('无法读取本地记录，未覆盖已有数据：' + error.message); }
    refresh();
    el('remember-progress').addEventListener('change', safe(function () {
      state.remember = el('remember-progress').checked;
      state.last = state.remember ? adapter.snapshot() : null;
      write();
      message(state.remember ? '已启用本机进度保存；出生资料不会上传。' : '已关闭并清除自动恢复记录，手动保存的命例仍保留。');
    }));
    el('save-case').addEventListener('click', safe(function () {
      var snapshot = adapter.snapshot();
      if (!snapshot) throw new Error('请先生成命盘。');
      if (state.cases.length >= 100) throw new Error('已保存 100 个命例，请先备份并清理不需要的命例。');
      var item = { id: id(), name: el('case-name').value.trim().slice(0, 60) || snapshot.input.birthDate + ' · ' + snapshot.input.gender,
        savedAt: new Date().toISOString(), snapshot: snapshot };
      var previous = state.cases; state.cases = previous.concat([item]);
      try { write(); } catch (error) { state.cases = previous; throw error; }
      refresh(); el('saved-cases').value = item.id; message('已在本机保存“' + item.name + '”，包含查看日期、层级和所选宫位。');
    }));
    el('load-case').addEventListener('click', safe(function () {
      var item = state.cases.find(function (row) { return row.id === el('saved-cases').value; });
      if (!item) throw new Error('请选择已存命例。');
      restore(item.snapshot); el('case-name').value = item.name; message('已恢复“' + item.name + '”。');
    }));
    el('delete-case').addEventListener('click', safe(function () {
      var item = state.cases.find(function (row) { return row.id === el('saved-cases').value; });
      if (!item || !window.confirm('删除命例“' + item.name + '”？只删除本机这条命例；如需恢复，请先备份。')) return;
      var previous = state.cases; state.cases = previous.filter(function (row) { return row.id !== item.id; });
      try { write(); } catch (error) { state.cases = previous; throw error; }
      refresh(); message('已删除所选本机命例；可从之前导出的备份恢复。');
    }));
    el('export-cases').addEventListener('click', safe(function () {
      if (!state.cases.length) throw new Error('请先保存至少一个命例。');
      download(new Blob([JSON.stringify({ format: 'ZDSM-cases', version: 1, cases: state.cases }, null, 2)], { type: 'application/json' }), '紫微命例备份.json');
      message('备份包含出生资料，请自行妥善保管。');
    }));
    el('import-cases').addEventListener('click', function () { el('case-import-file').click(); });
    el('case-import-file').addEventListener('change', async function () {
      try {
        var file = el('case-import-file').files[0]; if (!file) return;
        if (file.size > 2000000) throw new Error('备份文件过大，请选择小于 2 MB 的命例 JSON。');
        var imported = JSON.parse(await file.text());
        if (imported.format !== 'ZDSM-cases' || imported.version !== 1 || !Array.isArray(imported.cases) || !imported.cases.length) throw new Error('请选择本网站导出的命例备份。');
        if (state.cases.length + imported.cases.length > 100) throw new Error('导入后超过 100 个命例，请先清理。');
        var additions = imported.cases.map(function (item) {
          if (!item || typeof item.name !== 'string') throw new Error('备份命例名称无效。');
          adapter.validate(item.snapshot);
          return { id: id(), name: item.name.slice(0, 60), snapshot: item.snapshot, savedAt: new Date().toISOString() };
        });
        var previous = state.cases; state.cases = previous.concat(additions);
        try { write(); } catch (error) { state.cases = previous; throw error; }
        refresh(); message('已导入 ' + additions.length + ' 个命例，没有覆盖原命例。');
      } catch (error) { message(error.message || '导入失败，未覆盖原命例。'); }
      finally { el('case-import-file').value = ''; }
    });
    el('export-chart-png').addEventListener('click', safe(exportPng));
    el('print-current').addEventListener('click', function () { window.print(); });
    window.addEventListener('beforeprint', preparePrint);
    window.addEventListener('afterprint', finishPrint);
    window.matchMedia('print').addEventListener('change', function () { if (adapter.redraw) adapter.redraw(); });
    window.addEventListener('pagehide', function () {
      if (state.remember && adapter.snapshot()) { state.last = adapter.snapshot(); try { write(); } catch (_) {} }
    });
    if (state.remember && state.last) safe(function () { restore(state.last); message('已恢复本机上次进度。'); })();
  }
  window.ZDSMWorkspace = { mount: mount, remember: remember };
}());
