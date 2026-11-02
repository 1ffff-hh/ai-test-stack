/* v7 视觉评审截图：深色数据台，四页 */
const { launch } = require('./browser');
const path = require('path');
const fs = require('fs');

const BASE = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
const OUT = path.resolve(__dirname, '..', 'docs', 'design');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('ats_theme', 'dark');
      localStorage.setItem('ats_plan', 'b_dsh_volc');
      localStorage.setItem('ats_stack', JSON.stringify(['dsh']));
      localStorage.setItem('ats_picked', JSON.stringify(['volc']));
    } catch (e) {}
  });
  for (const [hash, name] of [['#home', 'v7-home.png'], ['#health', 'v7-health.png'], ['#evalset', 'v7-evalset.png'], ['#report?pe=aaaa', 'v7-report.png']]) {
    await page.goto(BASE + hash, { waitUntil: 'load' });
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, name), fullPage: true });
  }
  console.log('done');
  await browser.close();
})();
