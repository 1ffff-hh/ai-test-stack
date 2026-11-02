/* 打印路径验收：生成 A4 PDF + 打印预览截图，并检查页数 */
const { launch } = require('./browser');
const path = require('path');
const fs = require('fs');

const BASE = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
const OUT = path.resolve(__dirname, '..', 'docs', 'acceptance');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('ats_plan', 'b_dsh_volc');
      localStorage.setItem('ats_stack', JSON.stringify(['dsh']));
      localStorage.setItem('ats_picked', JSON.stringify(['volc']));
    } catch (e) {}
  });
  await page.goto(BASE + '#report?pe=aaaa', { waitUntil: 'load' });
  await page.waitForTimeout(700);

  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, 'report-print.png'), fullPage: true });

  const pdf = await page.pdf({
    path: path.join(OUT, 'report-sample.pdf'),
    format: 'A4',
    printBackground: true,
    margin: { top: '14mm', right: '12mm', bottom: '14mm', left: '12mm' }
  });
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  const size = fs.statSync(path.join(OUT, 'report-sample.pdf')).size;
  console.log(JSON.stringify({ pages, size, png: 'docs/acceptance/report-print.png', pdf: 'docs/acceptance/report-sample.pdf' }, null, 2));
  await browser.close();
})();
