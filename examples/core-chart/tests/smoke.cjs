const { chromium } = require('playwright');

const baseUrl = process.env.ZDSM_BASE_URL || 'http://127.0.0.1:49731/';
const screenshotPath = process.env.ZDSM_SCREENSHOT || '';
const systemScreenshotPath = process.env.ZDSM_SYSTEM_SCREENSHOT || '';
const reviewDir = process.env.ZDSM_REVIEW_DIR || '';
const path = require('path');
const viewport = {
  width: Number(process.env.ZDSM_VIEWPORT_WIDTH || 1365),
  height: Number(process.env.ZDSM_VIEWPORT_HEIGHT || 900),
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport });
  const errors = [];
  const remoteRequests = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (/^https?:$/.test(url.protocol) && url.origin !== new URL(baseUrl).origin) remoteRequests.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  assert(await page.evaluate(() => {
    const now = new Date();
    const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
    return document.getElementById('birth-date').value === today;
  }), '首次打开的出生日期应默认为本地当天');
  if (reviewDir) await page.screenshot({ path: path.join(reviewDir, 'input.png'), fullPage: true });
  assert(await page.evaluate(() => Boolean(window.iztro && window.ZDSMMonthlyRuntime && window.ZDSMDailyHourlyRuntime && window.ZDSMSystemEngine)), '本地脚本未全部载入');
  await page.fill('#birth-date', '1997-05-18');
  await page.click('#chart-form button[type="submit"]');
  await page.waitForSelector('#result:not([hidden])');
  assert(await page.locator('#goto-chart').getAttribute('aria-current') === 'page', '排盘后应默认进入命盘');
  assert(await page.locator('#palace-details').getAttribute('open') === null, '宫位详情默认应收起');
  const chartLayout = await page.evaluate(() => ({
    chartBottom: document.querySelector('.chart-section').getBoundingClientRect().bottom,
    pickerTop: document.querySelector('.transit-browser').getBoundingClientRect().top,
    scrollWidth: document.documentElement.scrollWidth,
    width: innerWidth,
    clippedPalaces: [...document.querySelectorAll('.palace')].filter((el) => el.scrollHeight > el.clientHeight + 2).length,
  }));
  assert(chartLayout.pickerTop - chartLayout.chartBottom < 25, '运限选择应紧贴命盘');
  assert(chartLayout.scrollWidth <= chartLayout.width, '页面出现整体横向溢出');
  assert(chartLayout.clippedPalaces === 0, '宫内数据被裁切');
  assert(await page.locator('#yearly-options .selected').evaluate((el) => {
    const item = el.getBoundingClientRect();
    const row = el.parentElement.getBoundingClientRect();
    return item.left >= row.left - 1 && item.right <= row.right + 1;
  }), '当前选中的年份没有滚到可见位置');
  if (reviewDir) await page.screenshot({ path: path.join(reviewDir, 'chart.png'), fullPage: true });
  await page.click('#goto-monthly');
  await page.waitForSelector('#monthly-page:not([hidden])');
  assert(await page.locator('#monthly-error').isHidden(), '月运页面出现错误');
  assert(await page.locator('#monthly-transformations .monthly-transform').count() === 4, '流月四化不是 4 条');
  const firstMonthTitle = await page.locator('#monthly-title').innerText();
  const monthButtons = page.locator('#monthly-quick-options [data-monthly-index]');
  if (await monthButtons.count() > 1) {
    await monthButtons.nth(1).click();
    await page.waitForTimeout(80);
    assert((await page.locator('#monthly-title').innerText()) !== firstMonthTitle, '切换流月后月运标题没有变化');
  }

  if (reviewDir) await page.screenshot({ path: path.join(reviewDir, 'monthly.png'), fullPage: true });
  await page.click('#goto-system');
  await page.click('#reading-system');
  await page.waitForSelector('#system-page:not([hidden])');
  assert(await page.locator('#system-error').isHidden(), '系统结构页面出现错误');
  assert(await page.locator('#system-roles .system-role-card').count() === 7, '系统角色摘要不是 7 项');
  assert(await page.locator('#system-scores .system-score').count() === 12, '系统结构未输出十二宫分数');
  const systemRoleText = await page.locator('#system-roles').innerText();
  assert(systemRoleText.includes('官禄') && systemRoleText.includes('田宅'), '系统结构未识别官禄处理中枢或田宅积累');
  if (systemScreenshotPath) await page.screenshot({ path: systemScreenshotPath, fullPage: true });
  if (reviewDir) await page.screenshot({ path: path.join(reviewDir, 'system.png'), fullPage: true });

  await page.click('#goto-report');
  await page.waitForSelector('#report-output .report-section');
  await page.locator('#report-output .report-section > summary').first().click();
  assert(await page.locator('#report-output .report-section[open]').count() === 1, '宫位解读无法展开');
  if (reviewDir) await page.screenshot({ path: path.join(reviewDir, 'report.png'), fullPage: true });

  await page.click('#goto-daily');
  await page.waitForSelector('#daily-page:not([hidden])');
  assert(await page.locator('#daily-error').isHidden(), '流日页面出现错误');
  assert(await page.locator('#daily-networks .daily-network-card').count() === 2, '只选日期时不应出现流时网络');
  assert(await page.locator('#daily-chain > div').count() === 5, '只看流日时作用链层数不正确');

  await page.click('#daily-today');
  const todayState = await page.evaluate(() => {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return {
      expected: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      selected: document.querySelector('#daily-target-date').value,
      timeWindow: document.querySelector('#daily-time-window').value,
    };
  });
  assert(todayState.selected === todayState.expected, '“今天”入口没有切换到本地当天');
  assert(todayState.timeWindow === '', '“今天”入口默认应只分析到流日');
  assert(await page.locator('#daily-networks .daily-network-card').count() === 2, '“今天”入口不应自动叠加流时');

  await page.selectOption('#daily-time-window', '5');
  await page.click('#daily-generate');
  assert(await page.locator('#daily-error').isHidden(), '流时页面出现错误');
  assert(await page.locator('#daily-networks .daily-network-card').count() === 3, '选择时辰后应出现流时网络');
  assert(await page.locator('#daily-chain > div').count() === 6, '选择流时后作用链层数不正确');
  assert((await page.locator('#daily-calendar-label').innerText()).includes('巳时'), '流时时段标签未更新');
  assert(await page.locator('#daily-assessment-title').innerText(), '当前窗口结论为空');

  if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });
  if (reviewDir) await page.screenshot({ path: path.join(reviewDir, 'daily.png'), fullPage: true });
  await page.click('#goto-chart');
  assert(await page.locator('#result').isVisible(), '无法返回完整命盘');
  assert(await page.locator('#chart-grid .palace').count() === 12, '完整命盘未显示十二宫');
  await page.locator('#hourly-options .selected').click();
  assert(await page.locator('#chart-grid').getAttribute('data-scope') === 'daily', '取消流时后没有回到流日盘');
  const beforeDailyPalace = await page.locator('#chart-grid .palace.selected-palace').getAttribute('data-palace-index');
  const dayOptions = page.locator('#daily-options [data-level="daily"]');
  const selectedDay = page.locator('#daily-options [data-level="daily"].selected');
  const selectedDayValue = await selectedDay.getAttribute('data-value');
  const dayValues = await dayOptions.evaluateAll((els) => els.map((el) => Number(el.dataset.value)));
  const adjacent = dayValues.includes(Number(selectedDayValue) + 1) ? Number(selectedDayValue) + 1 : Number(selectedDayValue) - 1;
  const nextDay = page.locator(`#daily-options [data-value="${adjacent}"]`);
  await nextDay.click();
  const afterDailyPalace = await page.locator('#chart-grid .palace.selected-palace').getAttribute('data-palace-index');
  assert(beforeDailyPalace !== afterDailyPalace, '切换流日后命盘主宫颜色位置没有变化');

  await page.click('#goto-today');
  await page.waitForSelector('#daily-page:not([hidden])');
  assert(await page.locator('#daily-time-window').inputValue() === '', '完整命盘的“今天”入口没有回到流日模式');
  assert(await page.locator('#daily-networks .daily-network-card').count() === 2, '完整命盘的“今天”入口错误叠加了流时');
  assert(remoteRequests.length === 0, '出现外部请求：' + remoteRequests.join(', '));
  assert(errors.length === 0, '页面错误：' + errors.join(' | '));

  console.log(JSON.stringify({
    status: 'pass', monthlyTransformations: 4, dailyOnlyNetworks: 2,
    hourlyNetworks: 3, systemRoles: 7, systemScores: 12,
    chartPalaces: 12, chartFirst: true, noOverflow: true, noClippedPalaces: true,
    todayEntryDailyOnly: true, todayShortcutWorks: true,
    dailyPalaceColorChanged: true, remoteRequests: remoteRequests.length,
  }));
  await browser.close();
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
