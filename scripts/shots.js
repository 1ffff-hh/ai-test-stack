/* 生成 docs/shots 下的视觉基线（人工比对用，不做像素 diff）
   用法：node scripts/shots.js
   产物：docs/shots/*.png（桌面浅色为主 + 深色对照 + 移动端） */
const { launch } = require('./browser');
const path = require('path');
const fs = require('fs');
const BASE = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
const OUT = path.resolve(__dirname, '..', 'docs', 'shots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await launch();

  async function ctx(w, h, theme) {
    const c = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    const p = await c.newPage();
    await p.addInitScript(t => { try { localStorage.setItem('ats_theme', t); } catch (e) {} }, theme);
    return { c, p };
  }
  async function shot(p, hash, name, wait = 550) {
    await p.goto(BASE + hash, { waitUntil: 'load' });
    await p.waitForTimeout(wait);
    await p.screenshot({ path: path.join(OUT, name) });
  }

  // 桌面深色：核心页面
  {
    const { c, p } = await ctx(1440, 1050, 'dark');
    await shot(p, '', '01-home.png', 700);
    await shot(p, '#news', '02-news.png');
    await shot(p, '#impact', '03-impact.png');
    await shot(p, '#roles', '04-roles.png');
    await shot(p, '#free', '05-free.png');
    await shot(p, '#tools', '06-tools.png');
    await shot(p, '#plans', '07-plans.png');
    await shot(p, '#map', '08-map.png');
    await shot(p, '#all', '09-all.png');
    await p.evaluate(() => {
      try {
        localStorage.setItem('ats_plan', 'b_dsh_volc');
        localStorage.setItem('ats_stack', JSON.stringify(['dsh']));
        localStorage.setItem('ats_picked', JSON.stringify(['volc']));
      } catch (e) {}
    });
    await shot(p, '#plan', '10-plan.png', 800);
    await shot(p, '#sources', '11-sources.png');
    await shot(p, '#health', '18-health.png');
    await shot(p, '#evalset', '19-evalset.png');
    await shot(p, '#report?pe=aaaa', '20-report.png', 700);
    await c.close();
  }

  // 首页诊断报告态（深色）
  {
    const { c, p } = await ctx(1440, 1050, 'dark');
    await p.goto(BASE, { waitUntil: 'load' });
    await p.waitForTimeout(600);
    for (const v of ['regress', '100', 'cn']) {
      await p.click(`#dopts .dchip[data-v="${v}"]`);
      await p.waitForTimeout(1500);
    }
    await p.screenshot({ path: path.join(OUT, '12-home-report.png') });
    await c.close();
  }

  // 浅色对照
  {
    const { c, p } = await ctx(1440, 1050, 'light');
    await shot(p, '', '13-home-light.png', 700);
    await shot(p, '#roles', '14-roles-light.png');
    await c.close();
  }

  // 移动端
  {
    const { c, p } = await ctx(390, 844, 'dark');
    await shot(p, '', '15-home-mobile.png', 650);
    await shot(p, '#news', '16-news-mobile.png');
    await shot(p, '#roles', '17-roles-mobile.png');
    await p.evaluate(() => {
      try {
        localStorage.setItem('ats_plan', 'b_dsh_volc');
        localStorage.setItem('ats_stack', JSON.stringify(['dsh']));
        localStorage.setItem('ats_picked', JSON.stringify(['volc']));
      } catch (e) {}
    });
    await shot(p, '#report?pe=aaaa', '21-report-mobile.png', 650);
    await c.close();
  }

  await browser.close();
  console.log('✓ docs/shots 已更新');
})();
