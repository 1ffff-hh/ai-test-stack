/* 交互验收：复制待办 / 单条评测 / 报告 Markdown 的 toast 反馈 */
const { launch } = require('./browser');
const path = require('path');
const BASE = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');

(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('ats_plan', 'b_dsh_volc');
      localStorage.setItem('ats_stack', JSON.stringify(['dsh']));
      localStorage.setItem('ats_picked', JSON.stringify(['volc']));
    } catch (e) {}
  });
  const out = {};
  for (const [hash, sel, key] of [
    ['#health', '#healthCopyTodo', 'health'],
    ['#evalset', '#evalGrid .ecCopy', 'eval'],
    ['#report', '#rpCopy', 'report']
  ]) {
    await page.goto(BASE + hash, { waitUntil: 'load' });
    await page.waitForTimeout(650);
    await page.click(sel);
    await page.waitForTimeout(500);
    out[key] = await page.evaluate(() => {
      const t = document.querySelector('#toast');
      return { on: t && t.classList.contains('on'), text: (t && t.textContent) || '' };
    });
  }
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();
