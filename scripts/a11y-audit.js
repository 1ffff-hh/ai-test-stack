const { launch } = require('./browser');
const path = require('path');
// 从项目根解析，不管在哪个目录执行
const FILE = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
// 42 个视图 = 24 个功能页 + home/map/all + 7 个站务页 + error + 6 个模块页 + 404
// 站务页与 error 是 v2.3 新增，必须进这份清单——审计漏一页，就等于那一页没有对比度保证。
const VIEWS = ['home','overview','report','matrix','tools','capabilities','plans','promos','free','bundles','persona','aitest','events','news','impact','roles','evalset','versus','roadmap','stack','plan','opinion','changelog','sources','health','map','all','search','mine','feedback','about','help','privacy','contact','error','mod-diagnose','mod-grow','mod-shift','mod-toolkit','mod-choose','mod-data','404'];

// 真正的对比度算法：沿 DOM 往上找出第一个不透明背景，再把半透明层合成上去
const PROBE = () => {
  const parse = (c) => {
    const m = c.match(/[\d.]+/g);
    if (!m) return null;
    return [Number(m[0]), Number(m[1]), Number(m[2]), m.length > 3 ? Number(m[3]) : 1];
  };
  const blend = (fg, bg) => {
    const a = fg[3];
    return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1];
  };
  const effBg = (el) => {
    let layers = [];
    let cur = el;
    while (cur && cur !== document.documentElement) {
      const c = parse(getComputedStyle(cur).backgroundColor);
      if (c && c[3] > 0) { layers.push(c); if (c[3] >= 0.999) break; }
      cur = cur.parentElement;
    }
    let base = [255, 255, 255, 1];
    const htmlBg = parse(getComputedStyle(document.documentElement).backgroundColor);
    const bodyBg = parse(getComputedStyle(document.body).backgroundColor);
    if (bodyBg && bodyBg[3] >= 0.999) base = bodyBg;
    for (let i = layers.length - 1; i >= 0; i--) base = blend(layers[i], base);
    return base;
  };
  const relLum = (c) => {
    const f = c.slice(0, 3).map(v => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
  };
  const ratio = (a, b) => {
    const l1 = relLum(a), l2 = relLum(b);
    const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  };

  const bad = [];
  const seen = new Set();
  // 扫 body 全部，不只 .view.on：侧栏、抽屉、命令面板、过期提示条都在视图外，
  // 只查 .view.on 会漏掉它们（浅色导航选中项隐形就是这么漏过去的）。
  const els = Array.from(document.querySelectorAll('body *'));
  els.forEach(el => {
    if (!el) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return;
    const r = el.getBoundingClientRect();
    if (r.width < 12 || r.height < 8) return;
    // 只检查真的有文字的元素。这里必须是 >0 不是 >1——热力图每格只有单个字符，
    // 用 >1 会把 274 个格子全部跳过（深色下它们的字色曾经全是错的）。
    const own = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim().length > 0);
    if (!own) return;
    const fg0 = parse(cs.color);
    /* 渐变文字以前直接跳过，是个真盲区：v2.3 首页标题在浅色主题下
       用 #67e8f9→#a78bfa 渐变压在 #eef2f8 上，实测只有 1.29:1，门禁全绿。
       现在逐个取渐变里的色标，和「背后的实际底色」比，取最差的一档。 */
    if (!fg0 || fg0[3] === 0) {
      const clip = cs.backgroundClip === 'text' || cs.webkitBackgroundClip === 'text';
      if (!clip) return;
      const stops = [...(cs.backgroundImage || '').matchAll(/rgba?\(([^)]+)\)/g)]
        .map(m => m[1].split(/[,\s/]+/).filter(x => x !== '').map(Number))
        .filter(c => c.length >= 3 && (c.length < 4 || c[3] > 0));
      if (!stops.length) return;
      const gbg = effBg(el.parentElement || el);
      const gsize = parseFloat(cs.fontSize);
      const gbold = parseInt(cs.fontWeight, 10) >= 700;
      const gneed = (gsize >= 24 || (gsize >= 18.66 && gbold)) ? 3 : 4.5;
      let worst = null;
      for (const c of stops) {
        const r = ratio(c, gbg);
        if (!worst || r < worst.ratio) worst = { ratio: r, fg: c };
      }
      if (worst && worst.ratio < gneed - 0.05) {
        const sel = typeof el.className === 'string' && el.className.trim()
          ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : el.tagName;
        const key = sel + '|grad|' + Math.round(worst.ratio * 100);
        if (!seen.has(key)) {
          seen.add(key);
          bad.push({
            sel,
            ratio: +worst.ratio.toFixed(2),
            need: gneed,
            size: +gsize.toFixed(1),
            fg: `rgb(${worst.fg.slice(0, 3).map(Math.round).join(',')})`,
            bg: `rgb(${gbg.slice(0, 3).map(Math.round).join(',')})`,
            text: (el.textContent || '').trim().slice(0, 24),
            grad: true
          });
        }
      }
      return;
    }
    // 自己带渐变/图片背景的元素（logo、徽章）算不出真实底色，跳过——探针会误判
    if (cs.backgroundImage && cs.backgroundImage !== 'none' && cs.backgroundClip !== 'text') return;
    const bg = effBg(el);
    const fg = blend(fg0, bg);
    const cr = ratio(fg, bg);
    const size = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const need = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5;
    if (cr < need - 0.05) {
      const sel = typeof el.className === 'string' && el.className.trim()
        ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : el.tagName;
      // 同选择器同底色只报一次；不同底色（比如 lv1..lv5）要分别报，否则只看到一条
      const key = sel + '|' + Math.round(bg[0]) + ',' + Math.round(bg[1]) + ',' + Math.round(bg[2]);
      if (seen.has(key)) return;
      seen.add(key);
      bad.push({
        sel,
        ratio: +cr.toFixed(2),
        need,
        size: +size.toFixed(1),
        fg: `rgb(${fg.slice(0, 3).map(Math.round).join(',')})`,
        bg: `rgb(${bg.slice(0, 3).map(Math.round).join(',')})`,
        text: (el.textContent || '').trim().slice(0, 24)
      });
    }
  });

  // placeholder 是伪元素，上面的循环扫不到，单独查
  document.querySelectorAll('input').forEach(inp => {
    if (!inp.placeholder) return;
    const cs = getComputedStyle(inp, '::placeholder');
    const fg0 = parse(cs.color);
    if (!fg0 || fg0[3] === 0) return;
    const bg = effBg(inp);
    const cr = ratio(blend(fg0, bg), bg);
    if (cr < 4.45) {
      bad.push({
        sel: 'input::placeholder',
        ratio: +cr.toFixed(2),
        need: 4.5,
        size: +(parseFloat(cs.fontSize) || 12).toFixed(1),
        fg: `rgb(${blend(fg0, bg).slice(0, 3).map(Math.round).join(',')})`,
        bg: `rgb(${bg.slice(0, 3).map(Math.round).join(',')})`,
        text: inp.placeholder.slice(0, 24)
      });
    }
  });

  return bad.slice(0, 25);
};

(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const out = {};

  for (const theme of ['dark', 'light']) {
    await page.goto(FILE, { waitUntil: 'load' });
    await page.evaluate(t => localStorage.setItem('ats_theme', t), theme);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);
    const rep = {};
    let total = 0;
    for (const v of VIEWS) {
      await page.evaluate(v => { location.hash = '#' + v; }, v);
      await page.waitForTimeout(180);
      const bad = await page.evaluate(PROBE);
      if (bad.length) { rep[v] = bad; total += bad.length; }
    }
    // 首页诊断「报告态」单独审一次：默认审计只覆盖初始问题态，报告卡是另一套配色
    await page.evaluate(() => { location.hash = '#home'; });
    await page.waitForTimeout(300);
    for (const v of ['regress', '100', 'cn']) {
      await page.click(`#dopts .dchip[data-v="${v}"]`).catch(() => {});
      await page.waitForTimeout(1200);
    }
    const repBad = await page.evaluate(PROBE);
    if (repBad.length) { rep['home-report'] = repBad; total += repBad.length; }
    out[theme] = { total, detail: rep };
  }
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
  process.exitCode = (out.dark.total + out.light.total) ? 1 : 0;
})();
