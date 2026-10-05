const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const baseUrl = process.env.ZDSM_BASE_URL || 'http://127.0.0.1:49731/';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [timezoneId, instant, today] of [
      ['Asia/Shanghai', '2026-10-04T16:30:00Z', '2026-10-05'],
      ['America/Los_Angeles', '2026-10-05T06:30:00Z', '2026-10-04'],
    ]) {
      const context = await browser.newContext({ timezoneId });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.clock.setFixedTime(new Date(instant));
      await page.goto(baseUrl, { waitUntil: 'networkidle' });
      assert.equal(await page.locator('#birth-date').inputValue(), today, timezoneId + ' uses local today');
      assert.equal(await page.locator('#target-date').inputValue(), today);
      await page.click('#chart-form button[type="submit"]');
      await page.waitForSelector('#result:not([hidden])');
      await page.click('#back-to-input');
      await page.fill('#birth-date', '1991-05-18');
      await page.click('#chart-form button[type="submit"]');
      await page.waitForSelector('#result:not([hidden])');
      assert.equal(await page.locator('#birth-date').inputValue(), '1991-05-18', 'manual input is preserved');
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal(await page.locator('#birth-date').inputValue(), today, 'fresh opening defaults to today without remember');
      assert.deepEqual(errors, []);
      await context.close();
      console.log('PASS default birth date: ' + timezoneId);
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
