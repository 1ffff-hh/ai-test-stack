const { launch } = require('./browser');
const path = require('path');
const fs = require('fs');

const FILE = 'file:///' + path.resolve(__dirname, '..', 'docs', 'design', 'v6-mock.html').replace(/\\/g, '/');
const OUT = path.resolve(__dirname, '..', 'docs', 'design');

(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await page.goto(FILE, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  const pages = await page.locator('.mockPage').all();
  const names = ['v6-health.png', 'v6-evalset.png', 'v6-report.png'];
  for (let i = 0; i < pages.length; i++) {
    await pages[i].screenshot({ path: path.join(OUT, names[i]) });
  }
  await page.screenshot({ path: path.join(OUT, 'v6-overview.png'), fullPage: true });
  console.log('shots:', fs.readdirSync(OUT).filter(f => f.endsWith('.png')).join(', '));
  await browser.close();
})();
