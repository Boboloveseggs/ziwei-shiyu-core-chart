const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.ZDSM_BASE_URL || 'http://127.0.0.1:49732/';
const outputDir = path.resolve(process.env.ZDSM_SCREENSHOT_DIR || path.join(__dirname, '..', 'docs', 'screenshots'));

function ensureFiniteBox(box, name) {
  if (!box || ![box.x, box.y, box.width, box.height].every(Number.isFinite)) {
    throw new Error(`无法定位截图区域：${name}`);
  }
  return box;
}

async function captureRange(page, startSelector, endSelector, fileName, sidePadding = 24) {
  const start = ensureFiniteBox(await page.locator(startSelector).boundingBox(), startSelector);
  const end = ensureFiniteBox(await page.locator(endSelector).boundingBox(), endSelector);
  const pageWidth = await page.evaluate(() => document.documentElement.clientWidth);
  const y = Math.max(0, start.y - 18);
  const bottom = end.y + end.height + 18;
  await page.screenshot({
    path: path.join(outputDir, fileName),
    clip: { x: sidePadding, y, width: pageWidth - sidePadding * 2, height: bottom - y },
  });
}

async function prepareChart(page) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.fill('#birth-date', '1997-05-18');
  await page.selectOption('#birth-time', '8');
  await page.fill('#target-date', '2026-10-10');
  await page.selectOption('#target-time', '5');
  await page.click('#chart-form button[type="submit"]');
  await page.waitForSelector('#result:not([hidden])');
  await page.waitForTimeout(250);
}

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 3000 }, deviceScaleFactor: 1 });
  await prepareChart(desktop);

  await captureRange(desktop, '.chart-section', '.transit-note', '01-main-chart.png');
  await desktop.locator('.chart-section').screenshot({ path: path.join(outputDir, '08-palace-network-arrows.png') });

  await desktop.click('#goto-yearly');
  await desktop.waitForSelector('#yearly-page:not([hidden])');
  await desktop.waitForTimeout(120);
  await captureRange(desktop, '#workspace-nav', '#yearly-page .monthly-primary-grid', '02-yearly.png');

  await desktop.click('#goto-monthly');
  await desktop.waitForSelector('#monthly-page:not([hidden])');
  const juneButton = desktop.locator('#monthly-quick-options button').filter({ hasText: /^六月/ }).first();
  if (await juneButton.count()) {
    await juneButton.click();
    await desktop.waitForTimeout(150);
  }
  await captureRange(desktop, '#workspace-nav', '#monthly-page .monthly-primary-grid', '03-monthly.png');

  await desktop.click('#goto-daily');
  await desktop.waitForSelector('#daily-page:not([hidden])');
  await desktop.fill('#daily-target-date', '2026-10-10');
  await desktop.selectOption('#daily-time-window', '5');
  await desktop.selectOption('#daily-event-context', 'writing');
  await desktop.click('#daily-generate');
  await desktop.waitForSelector('#daily-content:not([hidden])');
  await desktop.waitForTimeout(150);
  await captureRange(desktop, '#workspace-nav', '#daily-networks', '04-daily-hourly.png');

  await desktop.click('#goto-system');
  await desktop.waitForSelector('#report-page:not([hidden])');
  const firstReport = desktop.locator('#report-output .report-section').first();
  if (await firstReport.count()) await firstReport.locator('> summary').click();
  await desktop.waitForTimeout(120);
  await captureRange(desktop, '#workspace-nav', '#report-output', '05-palace-reading.png');

  await desktop.click('#reading-system');
  await desktop.waitForSelector('#system-page:not([hidden])');
  await desktop.waitForTimeout(120);
  await captureRange(desktop, '#workspace-nav', '#system-page .system-block', '06-natal-system.png');

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await prepareChart(mobile);
  await mobile.screenshot({ path: path.join(outputDir, '10-mobile-viewport.png') });
  await mobile.locator('.chart-section').screenshot({ path: path.join(outputDir, '07-mobile-chart.png') });

  console.log(JSON.stringify({ status: 'pass', outputDir, files: fs.readdirSync(outputDir).sort() }, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
