const { chromium } = require('playwright');

const baseUrl = process.env.ZDSM_BASE_URL || 'http://127.0.0.1:49731/';
const assert = (condition, message) => { if (!condition) throw new Error(message); };

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  assert(await page.locator('#default-profile-note').isVisible(), '默认资料提示应在首次打开时出现');
  await page.fill('#birth-date', '1997-05-18');
  assert(await page.locator('#default-profile-note').isHidden(), '用户修改出生资料后默认提示应隐藏');

  await page.selectOption('#calendar-type', 'lunar');
  assert(await page.locator('#birth-date').getAttribute('type') === 'text', '农历出生日期不能继续使用公历 date 控件');
  await page.fill('#birth-date', '2023-02-30');
  await page.locator('#leap-month').setChecked(false);
  await page.fill('#target-date', '2026-10-10');
  await page.click('#chart-form button[type="submit"]');
  assert(await page.locator('#result').isVisible(), '合法农历二月三十应可以排盘');

  await page.click('#back-to-input');
  await page.locator('#leap-month').setChecked(true);
  await page.click('#chart-form button[type="submit"]');
  assert((await page.locator('#status').innerText()).includes('不存在'), '不存在的闰二月三十必须明确报错');

  await page.selectOption('#calendar-type', 'solar');
  await page.fill('#birth-date', '1990-06-15');
  await page.fill('#target-date', '2026-02-05');
  await page.locator('.method-settings').evaluate((element) => { element.open = true; });
  await page.selectOption('#horoscope-divide', 'exact');
  await page.click('#chart-form button[type="submit"]');
  assert(await page.locator('#result').isVisible(), '立春边界案例排盘失败');
  const selectedYear = page.locator('#yearly-options .selected');
  assert((await selectedYear.locator('strong').innerText()).includes('2026年'), '立春后的实际流年没有成为当前选中项');
  assert((await selectedYear.locator('span').innerText()).includes('当前流年'), '当前选中项没有注明流年口径');
  assert((await page.locator('#yearly-options .calendar-container').innerText()).includes('2025农历年'), '农历容器年没有被单独标注');
  assert((await page.locator('#selection-summary').innerText()).includes('2026年'), '当前选择摘要仍误写为农历容器年');

  await page.click('#goto-yearly');
  assert((await page.locator('#yearly-title').innerText()).startsWith('2026年'), '年运标题没有跟随实际流年');
  await page.click('#goto-monthly');
  const monthlyTitle = await page.locator('#monthly-title').innerText();
  assert(/公历 \d{4}-\d{2}-\d{2}—\d{4}-\d{2}-\d{2}/.test(monthlyTitle), '流月标题没有展示完整公历起止日期');
  assert(await page.locator('#monthly-change-content .period-change-grid article').count() === 3, '流月缺少核心宫、网络、四化三项结构对照');
  const axisLabels = await page.locator('#monthly-axes .monthly-axis header span').allTextContents();
  assert(axisLabels.includes('主要') || axisLabels.includes('并列'), '月运没有给出可解释的主要轴或并列结论');
  if (!axisLabels.includes('并列')) assert(axisLabels.filter((label) => label === '主要').length <= 2, '月运仍机械地把所有维度列为重点');

  await page.click('#goto-daily');
  assert(await page.locator('#daily-change-content .period-change-grid article').count() === 3, '流日缺少与前一天的结构对照');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('#goto-chart');
  assert(await page.locator('#chart-grid .palace').count() === 12, '手机视图丢失完整十二宫');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '手机视图出现页面级横向溢出');
  await page.locator('#chart-grid .palace').first().click();
  assert(await page.locator('#palace-details').getAttribute('open') !== null, '手机点击宫位后应直接展开宫位解读');
  assert(errors.length === 0, '页面错误：' + errors.join(' | '));

  console.log(JSON.stringify({ status: 'pass', lunarDay30: true, leapValidation: true,
    exactYearBoundary: true, monthSolarRange: true, periodComparison: true, mobileChart: true }));
  await browser.close();
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
