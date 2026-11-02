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

  /* v2.3 站务层：7 个站务页 + 出错兜底页。
     个人中心要先塞一份收藏与浏览记录，否则截出来是四个空态——那不是这页想给人看的样子。 */
  {
    const { c, p } = await ctx(1440, 1050, 'dark');
    await p.addInitScript(() => {
      try {
        localStorage.setItem('ats_fav', JSON.stringify([
          { k: 'tool', id: 'dsh', n: 'DeepSeek Harness', go: '#tools', t: Date.now() - 6e5 },
          { k: 'bundle', id: 'b_dsh_volc', n: 'DSH + 火山方舟 Lite', go: '#bundles', t: Date.now() - 3e6 },
          { k: 'page', id: 'plans', n: '套餐对比', go: '#plans', t: Date.now() - 9e6 }
        ]));
        localStorage.setItem('ats_recent', JSON.stringify([
          { v: 'plans', t: Date.now() - 4e5 }, { v: 'tools', t: Date.now() - 2e6 },
          { v: 'bundles', t: Date.now() - 5e6 }, { v: 'map', t: Date.now() - 8e6 }
        ]));
        localStorage.setItem('ats_stack', JSON.stringify(['dsh']));
        localStorage.setItem('ats_picked', JSON.stringify(['volc']));
        localStorage.setItem('ats_diag', JSON.stringify([
          { bId: 'b_dsh_volc', q: { goal: '日常回归自动化', budget: '¥100 以内', cstr: '必须国内直连' }, t: Date.now() - 7e5 }
        ]));
      } catch (e) {}
    });
    await shot(p, '#search', '22-search.png');
    await shot(p, '#mine', '23-mine.png');
    await shot(p, '#feedback', '24-feedback.png');
    await shot(p, '#about', '25-about.png');
    await shot(p, '#help', '26-help.png');
    await shot(p, '#privacy', '27-privacy.png');
    await shot(p, '#contact', '28-contact.png');
    await c.close();
  }

  /* 出错兜底页：得先真的让它出错，直接开 #error 只有半页空壳。
     塞一条 null 进数据（渲染函数引用的是同一个数组），再跳到 #overview。 */
  {
    const { c, p } = await ctx(1440, 900, 'dark');
    await p.goto(BASE, { waitUntil: 'load' });
    await p.waitForTimeout(600);
    await p.evaluate(() => { window.__DATA__.tools.push(null); location.hash = '#overview'; });
    await p.waitForTimeout(700);
    await p.screenshot({ path: path.join(OUT, '29-error.png') });
    await c.close();
  }

  await browser.close();
  console.log('✓ docs/shots 已更新');
})();
