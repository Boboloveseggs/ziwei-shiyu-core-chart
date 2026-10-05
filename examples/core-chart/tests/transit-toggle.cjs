const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const baseUrl = process.env.ZDSM_BASE_URL || 'http://127.0.0.1:49731/';
const levels = ['decadal', 'yearly', 'monthly', 'daily', 'hourly'];

async function verifyScope(page, level, expected) {
  assert.equal(await page.locator('#chart-grid').getAttribute('data-scope'), level);
  assert.equal(await page.locator('#chart-grid').getAttribute('data-transit-level'), level);
  const depth = levels.indexOf(level);
  for (const [index, scope] of levels.entries()) {
    const count = index <= depth ? 1 : 0;
    assert.equal(await page.locator(`#${scope}-options .selected`).count(), count, `${scope} 选中状态`);
    assert.equal(await page.locator(`#${scope}-options [aria-selected="true"]`).count(), count);
    assert.equal(await page.locator(`#chart-grid .marker-${scope}`).count(), count, `${scope} 落宫标记`);
  }
  assert.equal(await page.locator('.selected-palace').getAttribute('data-palace-index'), String(expected[level].index));
  const related = await page.locator('.related-palace').evaluateAll((els) => els.map((el) => Number(el.dataset.palaceIndex)).sort((a, b) => a - b));
  assert.deepEqual(related, expected[level].related, `${level} 三方四正`);
  if (level === 'natal') {
    assert.equal(await page.locator('.flight-path').count(), 0, '本命盘不残留流时飞化');
    assert.equal(await page.locator('.chart-star-mutagen').count(), 4, '保留生年四化');
  } else {
    const routes = await page.locator('.flight-summary li span').allTextContents();
    assert.deepEqual(routes, expected[level].routes, `${level} 四化星曜及飞入宫位`);
    assert.equal(await page.locator('.flight-path').count(), 4);
  }
  const colors = await page.evaluate(() => ({
    main: getComputedStyle(document.querySelector('.selected-palace')).backgroundColor,
    related: getComputedStyle(document.querySelector('.related-palace')).backgroundColor,
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
  assert.notEqual(colors.main, colors.related, '主宫与三方颜色需要有区分');
  assert.equal(colors.overflow, false, '没有整体横向溢出');
}

async function run(browser, width) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.fill('#birth-date', '1997-05-18');
    await page.fill('#target-date', '2026-10-10');
    await page.selectOption('#target-time', '5');
    await page.click('#chart-form button[type="submit"]');
    await page.waitForSelector('#result:not([hidden])');

    // Independently use the existing engine, not the UI's computed state.
    const expected = await page.evaluate(() => {
      const value = (id) => document.getElementById(id).value;
      const chart = window.iztro.astro.withOptions({
        type: value('calendar-type'), dateStr: value('birth-date'),
        timeIndex: Number(value('birth-time')), gender: value('gender'),
        fixLeap: document.getElementById('fix-leap').checked, language: 'zh-CN',
        config: { algorithm: value('algorithm'), yearDivide: value('year-divide'),
          horoscopeDivide: value('horoscope-divide'), ageDivide: value('age-divide'), dayDivide: value('day-divide') },
      });
      const horoscope = chart.horoscope('2026-10-10', 5);
      return Object.fromEntries(['natal', 'decadal', 'yearly', 'monthly', 'daily', 'hourly'].map((level) => {
        const index = level === 'natal' ? chart.palace('命宫').index : horoscope[level].index;
        const network = chart.surroundedPalaces(index);
        return [level, { index,
          related: [network.opposite.index, network.wealth.index, network.career.index].sort((a, b) => a - b),
          routes: level === 'natal' ? [] : horoscope[level].mutagen.map((star) => {
            const target = chart.star(star).palace();
            return star + ' → ' + target.name;
          }),
        }];
      }));
    });
    const retained = {};
    for (const level of levels.slice(0, 4)) {
      retained[level] = await page.locator(`#${level}-options .selected`).getAttribute('data-value');
    }
    await verifyScope(page, 'daily', expected);
    await page.locator('#hourly-options [data-value="5"]').click();
    await verifyScope(page, 'hourly', expected);
    await page.locator('#hourly-options .selected').click();
    await verifyScope(page, 'daily', expected);
    assert(!(await page.locator('#selection-summary').innerText()).includes('巳时'));
    if (process.env.ZDSM_TOGGLE_REVIEW_DIR) await page.screenshot({ path: `${process.env.ZDSM_TOGGLE_REVIEW_DIR}/daily-${width}.png`, fullPage: true });
    await page.locator('#daily-options .selected').click();
    await verifyScope(page, 'monthly', expected);
    assert(!(await page.locator('#selection-summary').innerText()).includes('初一'));
    assert.equal(await page.locator('#target-date').inputValue(), '2026-10-10', '取消不修改日期');
    for (const level of levels.slice(0, 3)) {
      assert.equal(await page.locator(`#${level}-options .selected`).getAttribute('data-value'), retained[level]);
    }
    if (process.env.ZDSM_TOGGLE_REVIEW_DIR) await page.screenshot({ path: `${process.env.ZDSM_TOGGLE_REVIEW_DIR}/monthly-${width}.png`, fullPage: true });

    // Same retained value reactivates an inactive child; keyboard activation works too.
    await page.locator(`#daily-options [data-value="${retained.daily}"]`).focus();
    await page.keyboard.press('Enter');
    await verifyScope(page, 'daily', expected);
    await page.locator('#hourly-options [data-value="5"]').click();
    await page.locator('.palace').first().click();
    assert.equal(await page.locator('#chart-grid').getAttribute('data-scope'), 'manual');
    await page.locator('#hourly-options .selected').click();
    await verifyScope(page, 'daily', expected);
    await page.locator('#hourly-options [data-value="5"]').click();
    await page.locator('#daily-options .selected').click();
    await verifyScope(page, 'monthly', expected); // Cancels descendants as well.
    await page.locator('#monthly-options .selected').click();
    await verifyScope(page, 'yearly', expected);
    await page.locator('#yearly-options .selected').click();
    await verifyScope(page, 'decadal', expected);
    await page.locator('#decadal-options .selected').click();
    await verifyScope(page, 'natal', expected);
    await page.locator('#hourly-options [data-value="5"]').click();
    await verifyScope(page, 'hourly', expected);

    // P6 must not restore a cancelled hour when entering daily analysis.
    await page.click('#goto-daily');
    assert.equal(await page.locator('#daily-time-window').inputValue(), '5');
    assert.equal(await page.locator('#daily-networks .daily-network-card').count(), 3);
    await page.click('#goto-chart');
    await page.locator('#hourly-options .selected').click();
    await page.click('#goto-daily');
    assert.equal(await page.locator('#daily-time-window').inputValue(), '');
    assert.equal(await page.locator('#daily-networks .daily-network-card').count(), 2);
    assert.deepEqual(errors, []);
    return { width, status: 'pass', parentFocus: true, relatedPalaces: true, transformations: true, reselect: true, p6DailyOnly: true };
  } finally {
    await page.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const results = [];
    for (const width of [1365, 390]) results.push(await run(browser, width));
    console.log(JSON.stringify(results));
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
