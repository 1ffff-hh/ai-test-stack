#!/usr/bin/env node
/* 生成社媒分享图 → _site/og.png（1200×630）

   为什么要有：分享链接在微信/Slack/X 里的第一印象就是这张图。
   之前 twitter:card 声明了 summary_large_image，却没有 og:image —— 等于声明了「我有大图」然后不给图。

   为什么用浏览器渲染而不是画图库：这张图上的数字必须来自 data/*.json，
   否则「29 款工具」这类字样会和页面上的实际条目数脱节（这个站吃过一次亏）。
   浏览器渲染 = 用同一份数据、同一套字体、同一套配色，不引入图像处理依赖。

   用法： node scripts/build-og.js [--out _site/og.png]
   失败不阻塞发布：build-site.js 会捕获并把 og.png 记为「已跳过」。 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'));

function stats() {
  const tools = read('tools.json');
  const plans = read('plans.json');
  const fb = read('freebies.json');
  const evs = read('evalset.json');
  const meta = read('meta.json');
  const roles = read('roles.json');
  const vendors = new Set(plans.map(p => p.vendor));
  return {
    tools: tools.length,
    vendors: vendors.size,
    plans: plans.length,
    free: (fb.items || []).length,
    cases: (evs.cases || []).length,
    roles: (roles.roles || []).length,
    name: meta.siteName || 'AI Test Stack',
    verified: meta.lastVerified || '',
    version: meta.version || ''
  };
}

function cardHtml(s, site) {
  // 字号跟着数字长度走，否则等工具数涨到三位数就会顶到边框
  const n = String(s.tools);
  const size = n.length >= 3 ? 104 : 128;
  const cells = [
    [s.tools, '款 AI 工具'],
    [s.plans, '档国内外套餐'],
    [s.free, '条免费额度'],
    [s.cases, '条评测用例']
  ];
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{
    width:1200px;height:630px;overflow:hidden;position:relative;
    font-family:"Microsoft YaHei","PingFang SC","Hiragino Sans GB",system-ui,-apple-system,"Segoe UI",sans-serif;
    background:#070b12;color:#d6e0ef;
  }
  .glow{position:absolute;border-radius:50%;filter:blur(90px);opacity:.5}
  .g1{width:620px;height:620px;left:-160px;top:-260px;background:#22d3ee}
  .g2{width:560px;height:560px;right:-140px;bottom:-260px;background:#7c3aed}
  .wrap{position:relative;height:100%;padding:64px 72px;display:flex;flex-direction:column;justify-content:space-between}
  .top{display:flex;align-items:center;gap:18px}
  .mark{
    width:60px;height:60px;border-radius:16px;background:#2fe3d4;color:#0a0e14;
    display:grid;place-items:center;font:800 30px/1 ui-monospace,monospace;flex:0 0 auto
  }
  .brand{font-size:26px;font-weight:800;letter-spacing:.5px}
  .brand small{display:block;font-size:16px;font-weight:500;color:#8fa3bf;letter-spacing:0;margin-top:4px}
  h1{font-size:62px;line-height:1.16;font-weight:800;letter-spacing:-.5px;margin-top:8px}
  h1 em{font-style:normal;color:#2fe3d4}
  .sub{font-size:24px;color:#9fb2c9;margin-top:18px;line-height:1.5}
  .row{display:flex;gap:14px}
  .cell{
    flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);
    border-radius:16px;padding:18px 20px
  }
  .cell b{display:block;font-size:${size}px;line-height:.78;font-weight:800;color:#eaf2ff;
    font-family:ui-monospace,monospace;letter-spacing:-3px}
  .cell span{display:block;font-size:19px;color:#8fa3bf;margin-top:14px}
  .foot{display:flex;align-items:center;justify-content:space-between;font-size:20px;color:#7d90a8;margin-top:26px}
  .dot{color:#2fe3d4}
  </style></head><body>
  <div class="glow g1"></div><div class="glow g2"></div>
  <div class="wrap">
    <div>
      <div class="top">
        <div class="mark">AT</div>
        <div class="brand">${s.name}<small>AI 工具选型 × 测试角色 × AI 冲击</small></div>
      </div>
      <h1>别只挑最贵的那个，<br>挑一套<em>能一直用下去</em>的组合。</h1>
      <div class="sub">${s.vendors} 家厂商 · ${s.roles} 个测试角色 · 数据可下载 · 健康度可见 · 结论可打印</div>
    </div>
    <div>
      <div class="row">
        ${cells.map(([v, k]) => `<div class="cell"><b>${v}</b><span>${k}</span></div>`).join('')}
      </div>
      <div class="foot">
        <span>${site.url.replace(/^https?:\/\//, '') || 'AI Test Stack'}</span>
        <span>数据核验日 <span class="dot">${s.verified}</span> · v${s.version}</span>
      </div>
    </div>
  </div></body></html>`;
}

(async () => {
  const outArg = process.argv.indexOf('--out');
  const out = path.resolve(ROOT, outArg >= 0 ? process.argv[outArg + 1] : path.join('_site', 'og.png'));
  const { launch } = require('./browser');
  const { detect } = require('./site-base');

  const s = stats();
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
    await page.setContent(cardHtml(s, detect()), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await page.screenshot({ path: out, type: 'png' });
    await page.close();
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify({
    out: path.relative(ROOT, out).split(path.sep).join('/'),
    w: 1200, h: 630,
    kb: Math.round(fs.statSync(out).size / 1024),
    tools: s.tools
  }));
})().catch(e => {
  console.error(String(e.message || e).split('\n')[0]);
  process.exit(1);
});
