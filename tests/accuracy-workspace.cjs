const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require('playwright');
const baseUrl = process.env.ZDSM_BASE_URL || 'http://127.0.0.1:49731/';
const reviewDir = process.env.ZDSM_REVIEW_DIR || '';

async function generate(page, { birth = '1997-05-18', target = '2026-10-10', time = '5', fixLeap = true, dayDivide = 'current', ageDivide = 'normal' } = {}) {
  if (await page.locator('#back-to-input').isVisible()) await page.click('#back-to-input');
  await page.fill('#birth-date', birth);
  await page.fill('#target-date', target);
  await page.selectOption('#target-time', time);
  await page.locator('.method-settings').evaluate((el) => { el.open = true; });
  await page.locator('#fix-leap').setChecked(fixLeap);
  await page.selectOption('#day-divide', dayDivide);
  await page.selectOption('#age-divide', ageDivide);
  await page.click('#chart-form button[type="submit"]');
}

async function expectedChart(page) {
  return page.evaluate(() => {
    const value = (id) => document.getElementById(id).value;
    const chart = iztro.astro.withOptions({ type: value('calendar-type'), dateStr: value('birth-date'), timeIndex: Number(value('birth-time')),
      gender: value('gender'), fixLeap: document.getElementById('fix-leap').checked, language: 'zh-CN',
      config: { algorithm: value('algorithm'), yearDivide: value('year-divide'), horoscopeDivide: value('horoscope-divide'),
        ageDivide: value('age-divide'), dayDivide: value('day-divide') } });
    const horoscope = chart.horoscope(value('target-date'), Number(value('target-time')));
    const scope = document.getElementById('chart-grid').dataset.transitLevel;
    const lunar = iztro.astro.bySolar(value('target-date'), 6, chart.gender, false, 'zh-CN').rawDates.lunarDate;
    return { lunar, scope, index: horoscope[scope]?.index, dailyStem: horoscope.daily.heavenlyStem + horoscope.daily.earthlyBranch,
      rows: horoscope[scope] ? chart.palaces.map((p) => ({ index: p.index, name: horoscope[scope].palaceNames[p.index],
        stars: (horoscope[scope].stars?.[p.index] || []).map((s) => s.name) })) : [] };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1365, height: 950 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [], external = [];
  const artifactDir = reviewDir || await fs.mkdtemp(path.join(os.tmpdir(), 'zdsm-acceptance-'));
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== new URL(baseUrl).origin) external.push(request.url()); });
  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      for (const name of ['ZDSMMonthlyRuntime', 'ZDSMDailyHourlyRuntime']) {
        const analyze = window[name].analyze;
        window[name].analyze = function (chart, request) {
          const result = analyze(chart, request); window[name + 'Audit'] = { chart, request, result }; return result;
        };
      }
    });
    for (const birth of ['1991-05-18', '1998-03-04', '1992-05-18']) {
      await generate(page, { birth });
      const natal = await page.locator('.chart-star').evaluateAll((els) => els.filter((el) => el.querySelector('.chart-star-mutagen')).map((el) => ({
        name: el.querySelector('.chart-star-name').textContent, type: el.querySelector('.chart-star-mutagen').textContent,
      })));
      assert.equal(natal.length, 4);
      await page.click('#goto-monthly'); await page.click('#goto-daily');
      const audit = await page.evaluate(() => {
        const monthly = ZDSMMonthlyRuntimeAudit, daily = ZDSMDailyHourlyRuntimeAudit;
        return { input: daily.chart.palaces.flatMap((p) => p.major_stars.concat(p.aux_stars)).filter((s) => s.natal_transformation),
          monthly: monthly.result.resonance_nodes.flatMap((r) => r.evidence), daily: daily.result.resonance_nodes.flatMap((r) => r.evidence) };
      });
      assert.equal(audit.input.length, 4, birth + ' 保留完整生年四化');
      for (const star of natal) for (const field of ['monthly', 'daily']) {
        assert(audit[field].some((item) => item.replace(/\s/g, '').includes('本命' + star.name + '化' + star.type)), `${birth} ${field} 缺少本命${star.name}${star.type}`);
      }
    }

    await generate(page, { target: '2026-10-01' });
    await page.locator('#daily-options .selected').click();
    assert((await page.locator('.flight-summary').innerText()).includes('流月四化飞入'));
    assert.equal(await page.locator('.flight-summary li').count(), 4, '流月应保留完整四化路线');
    assert(!(await page.locator('.flight-summary').innerText()).includes('自化'), '流月飞回主宫不能标作宫干自化');
    for (let index = 0; index < 12; index++) {
      await page.locator(`.palace[data-palace-index="${index}"]`).click();
      const actual = await page.locator('.flight-summary li span').allTextContents();
      const expected = await page.evaluate((palaceIndex) => {
        const chart = iztro.astro.bySolar(document.getElementById('birth-date').value,
          Number(document.getElementById('birth-time').value), document.getElementById('gender').value,
          document.getElementById('fix-leap').checked, 'zh-CN');
        const source = chart.palaces[palaceIndex];
        return iztro.util.getMutagensByHeavenlyStem(source.heavenlyStem).map((star, i) => {
          const target = chart.star(star).palace();
          return star + ' → ' + target.name + (source.selfMutaged(['禄', '权', '科', '忌'][i]) ? '（自化）' : '');
        });
      }, index);
      assert.deepEqual(actual, expected, '宫干自化应仍按排盘引擎保留');
    }
    await page.click('#goto-system'); await page.click('#goto-report');
    assert(!(await page.locator('.report-summary').innerText()).includes('巳时'), '流月摘要不再显示已取消的流时');

    const boundaryCases = [
      { birth: '2026-06-06', target: '2026-10-10' },
      { target: '2026-02-16' }, { target: '2026-02-17' },
      { target: '2025-07-25', fixLeap: true }, { target: '2025-08-09', fixLeap: true },
      { target: '2025-08-09', fixLeap: false },
      { target: '2026-02-16', time: '12', dayDivide: 'current' },
      { target: '2026-02-16', time: '12', dayDivide: 'forward' },
      { target: '2021-03-01', ageDivide: 'birthday' },
    ];
    for (const item of boundaryCases) {
      await generate(page, item);
      assert(await page.locator('#result').isVisible(), JSON.stringify(item) + ': ' + await page.locator('#status').textContent());
      let expected = await expectedChart(page);
      assert((await page.locator('#yearly-options .selected strong').innerText()).includes(String(expected.lunar.lunarYear)));
      assert.equal(await page.locator('#daily-options .selected').getAttribute('data-value'), String(expected.lunar.lunarDay));
      assert.equal(await page.locator('#daily-options .selected span').innerText(), expected.dailyStem);
      assert.equal(await page.locator('.selected-palace').getAttribute('data-palace-index'), String(expected.index));
      if (item.target === '2025-08-09') assert.equal(await page.locator('#monthly-options button').count(), item.fixLeap ? 14 : 13);
      await page.locator('#hourly-options [data-value="6"]').click();
      assert.equal(await page.locator('#target-date').inputValue(), item.target, '换时辰不能改变查看日期');
      expected = await expectedChart(page);
      for (const row of expected.rows) {
        const node = page.locator(`.palace[data-palace-index="${row.index}"] .transit-scope-line`);
        assert((await node.locator('b').innerText()).endsWith(row.name));
        assert.equal(await node.locator('span').innerText(), row.stars.join('、') || '无流曜');
      }
      if (item.birth === '2026-06-06') {
        assert((await page.locator('#decadal-options .selected').innerText()).includes('童限'));
        await page.click('#goto-monthly');
        assert((await page.locator('#monthly-chain').innerText()).includes('童限'));
        await page.click('#goto-chart');
      }
    }
    await generate(page, { birth: '2026-06-06', target: '2026-06-06' });
    const priorDay = await page.locator('#daily-options .selected').getAttribute('data-value');
    await page.locator('#daily-options button').first().click();
    assert((await page.locator('#status').innerText()).includes('早于出生'));
    assert.equal(await page.locator('#target-date').inputValue(), '2026-06-06');
    assert.equal(await page.locator('#daily-options .selected').getAttribute('data-value'), priorDay);
    await generate(page, { birth: '2026-06-06', target: '2026-06-05' });
    assert((await page.locator('#status').innerText()).includes('早于出生'));
    await generate(page, { target: '2140-01-01' });
    assert((await page.locator('#status').innerText()).includes('超出'));
    await generate(page, { birth: '2080-06-06', target: '2080-10-10' });
    await page.click('#today-button');
    assert((await page.locator('#status').innerText()).includes('早于出生'));
    assert.equal(await page.locator('#target-date').inputValue(), '2080-10-10', '失败的今天操作必须保留原日期');
    await generate(page, { target: '2021-03-01', ageDivide: 'birthday' });
    await page.locator('#monthly-options button').last().click();
    assert((await page.locator('#decadal-options .selected').innerText()).includes('25–34'), '跨农历生日后大限选择应同步');

    // Persistence is opt-in, round-trips manual focus and retains the chosen layer.
    await generate(page);
    await page.locator('#daily-options .selected').click();
    await page.locator('.palace[data-palace-index="0"]').click();
    await page.click('#toggle-tools');
    assert.equal(await page.locator('#remember-progress').isChecked(), false);
    await page.fill('#case-name', '验收命例 <不是HTML>');
    await page.click('#save-case');
    assert((await page.locator('#local-tools-status').innerText()).includes('已在本机保存'));
    await page.check('#remember-progress');
    await page.reload({ waitUntil: 'networkidle' });
    assert(await page.locator('#result').isVisible());
    assert.equal(await page.locator('#chart-grid').getAttribute('data-transit-level'), 'monthly');
    assert.equal(await page.locator('#chart-grid').getAttribute('data-scope'), 'manual');
    assert.equal(await page.locator('.selected-palace').getAttribute('data-palace-index'), '0');
    assert.equal(await page.locator('#target-date').inputValue(), '2026-10-10');
    await page.click('#toggle-tools');
    assert.equal(await page.locator('#saved-cases option').innerText(), '验收命例 <不是HTML>');
    let downloading = page.waitForEvent('download');
    await page.click('#export-chart-png');
    const png = await downloading;
    const pngFile = path.join(artifactDir, 'chart-export.png'); await png.saveAs(pngFile);
    const pngBytes = await fs.readFile(pngFile);
    assert.equal(pngBytes.toString('hex', 0, 8), '89504e470d0a1a0a');
    assert(pngBytes.length > 20000);
    downloading = page.waitForEvent('download'); await page.click('#export-cases');
    const backupFile = path.join(artifactDir, 'cases.json'); await (await downloading).saveAs(backupFile);
    await page.setInputFiles('#case-import-file', backupFile);
    await page.waitForFunction(() => document.querySelector('#saved-cases').options.length === 2);
    await page.setInputFiles('#case-import-file', { name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
    assert.equal(await page.locator('#saved-cases option').count(), 2);
    await page.uncheck('#remember-progress');
    await page.reload({ waitUntil: 'networkidle' });
    assert(await page.locator('#input-page').isVisible(), '未勾选记住进度时不自动打开出生资料');
    await page.click('#toggle-tools'); await page.click('#load-case');
    assert.equal(await page.locator('#chart-grid').getAttribute('data-transit-level'), 'monthly');
    await page.click('#toggle-tools');

    await page.click('#goto-system'); await page.click('#goto-report');
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    assert(await page.locator('#report-output details[open]').count() > 0, '打印应展开报告');
    await page.emulateMedia({ media: 'print' });
    assert((await page.locator('#print-context').innerText()).includes('1997-05-18'));
    await page.pdf({ path: path.join(artifactDir, 'report.pdf'), preferCSSPageSize: true, printBackground: true });
    await page.emulateMedia({ media: 'screen' });
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    assert.equal(await page.locator('#report-output details[open]').count(), 0);
    await page.click('#goto-chart');
    for (const width of [1365, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(60);
      assert(await page.locator('#yearly-options .selected').evaluate((el) => {
        const rect = el.getBoundingClientRect(), parent = el.parentElement.getBoundingClientRect();
        return rect.left >= parent.left - 1 && rect.right <= parent.right + 1;
      }), width + ' 当前年份应该自动保持可见');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, width + ' 横向溢出');
      assert.equal(await page.locator('.palace').evaluateAll((els) => els.filter((el) => el.scrollHeight > el.clientHeight + 2).length), 0, width + ' 宫内裁切');
      await page.screenshot({ path: path.join(artifactDir, 'chart-' + width + '.png'), fullPage: true });
    }
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    console.log(JSON.stringify({ status: 'pass', natalCases: 3, manualPalaces: 12, boundaryCases: boundaryCases.length,
      optInPersistence: true, png: true, printableReport: true, backupImport: true, widths: [1365, 390, 320], externalRequests: 0, artifactDir }));
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
