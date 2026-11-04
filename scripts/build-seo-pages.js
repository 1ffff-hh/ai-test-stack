#!/usr/bin/env node
/* =========================================================
   长尾静态页：把「29 款工具 + 59 档套餐」变成能被单独收录的网址
   ---------------------------------------------------------
   为什么要有这一层：
     整站是一个单页应用，所有内容挂在 #hash 后面。搜索引擎只认
     一个地址（/），于是「Kimi 会员多少钱」这种真实搜索词永远
     没有对应的落地页——站里明明写着答案，却没人搜得到。

   这一层不改动应用本身：index.html 还是那个单文件站。
     它在旁边生成 /t/<工具>.html 与 /p/<套餐>.html，
     每页有自己的标题、描述、canonical、结构化数据，
     正文是数据里真实存在的字段，不是关键词堆砌。

   不做的事：不伪造评分、不写没有出处的结论、不生成聚合页。
   每页的数字都来自 data/*.json，改了数据重新构建就同步。

   用法：node scripts/build-seo-pages.js
        （通常由 scripts/build-site.js 调用，不单独跑）
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const read = f => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const readSafe = (f, fb) => { try { return read(f); } catch (e) { return fb; } };

/* ---------- 小工具 ---------- */
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const clip = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : t.slice(0, n - 1) + '…';
};
const money = n => '¥' + Number(n || 0).toLocaleString('zh-CN');
const list = (arr, cls) => (arr && arr.length)
  ? `<ul${cls ? ` class="${cls}"` : ''}>${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`
  : '<p class="dim">未记录</p>';

const CSS = `
:root{--bg:#0b1018;--card:#121a26;--line:#233043;--tx:#d6e0ef;--dim:#8b9bb4;--acc:#2fe3d4;--warn:#f0a868}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--tx);font:16px/1.75 system-ui,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
a{color:var(--acc);text-decoration:none}
a:hover{text-decoration:underline}
.wrap{max-width:760px;margin:0 auto;padding:0 20px}
header.top{border-bottom:1px solid var(--line);padding:14px 0;font-size:14px}
header.top .wrap{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
header.top .sep{color:var(--dim)}
main{padding:28px 0 40px}
h1{font-size:30px;line-height:1.3;margin:0 0 6px}
h2{font-size:19px;margin:34px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--line)}
.sub{color:var(--dim);margin:0 0 20px}
.tag{display:inline-block;font-size:12px;padding:2px 8px;border:1px solid var(--line);border-radius:99px;color:var(--dim);margin:0 6px 6px 0}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:18px 0}
.fact{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.fact b{display:block;font-size:12px;color:var(--dim);font-weight:500;margin-bottom:2px}
.fact span{font-size:15px}
.price{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px 20px;margin:18px 0}
.price .n{font-size:36px;font-weight:700;color:var(--acc)}
.price .note{color:var(--warn);font-size:14px;margin-top:4px}
.price .orig{color:var(--dim);font-size:14px}
table{width:100%;border-collapse:collapse;font-size:14px;margin:10px 0}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--dim);font-weight:500;font-size:13px}
.bar{display:inline-block;width:80px;height:6px;background:var(--line);border-radius:3px;overflow:hidden;vertical-align:middle;margin-right:8px}
.bar i{display:block;height:100%;background:var(--acc)}
.dim{color:var(--dim)}
.cta{display:inline-block;margin:26px 0 0;padding:12px 22px;background:var(--acc);color:#06231f;border-radius:10px;font-weight:600}
.cta:hover{text-decoration:none;filter:brightness(1.08)}
footer{border-top:1px solid var(--line);padding:20px 0 40px;color:var(--dim);font-size:13px}
ul{padding-left:20px}
li{margin:4px 0}
@media(max-width:520px){h1{font-size:24px}.price .n{font-size:28px}table{font-size:13px}}
`;

/* 相对链接：静态页在 /t/ 与 /p/ 两个子目录里，互相跳转必须算对层级。
   写死绝对路径会在换域名时全断，写死 '../' 又会让同目录链接多退一级。 */
function linker(dir) {
  return {
    home: '../',
    tool: id => (dir === 't' ? `${id}.html` : `../t/${id}.html`),
    plan: id => (dir === 'p' ? `${id}.html` : `../p/${id}.html`),
    res: id => (dir === 'c' ? `${id}.html` : `../c/${id}.html`),
    toolIndex: dir === 't' ? './' : '../t/',
    planIndex: dir === 'p' ? './' : '../p/',
    resIndex: dir === 'c' ? './' : '../c/'
  };
}

/* 页面骨架：所有页共用。title/desc/canonical/jsonLd 由调用方给。
   site 是站点绝对地址（给 og:image 与 canonical 用），L 是相对链接表。 */
function shell({ title, desc, canonical, jsonLd, crumbs, body, site, L }) {
  /* 面包屑里的 item 必须是绝对地址：相对路径在结构化数据里不被解析。
     用 canonical 做基准把 './'、'../t/' 还原成完整 URL。 */
  const crumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem', position: i + 1, name: c.name,
      ...(c.href ? { item: new URL(c.href, canonical).href } : {})
    }))
  };
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(site + 'og.png')}">
<meta property="og:locale" content="zh_CN">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<script type="application/ld+json">${JSON.stringify(crumbLd)}</script>
<style>${CSS}</style>
</head>
<body>
<header class="top"><div class="wrap">
<a href="${L.home}">AI Test Stack</a><span class="sep">·</span>
${crumbs.map(c => c.href ? `<a href="${c.href}">${esc(c.name)}</a>` : `<span>${esc(c.name)}</span>`).join('<span class="sep">·</span>')}
</div></header>
<main><div class="wrap">
${body}
</div></main>
<footer><div class="wrap">
<p>价格为公开页面核验值，市场变动快，下单前以厂商官网为准。评分是编辑判断，不是跑分。</p>
<p><a href="${L.home}">回到完整对比站</a> · 数据以 MIT 许可开放，可下载核对。</p>
</div></footer>
</body>
</html>
`;
}

/* ---------- 工具页 ---------- */
function toolPage(t, plans, tools, ctx) {
  const { site, L } = ctx;
  const own = plans.filter(p => p.toolId === t.id);
  const peers = tools.filter(x => x.id !== t.id && x.kind === t.kind).slice(0, 6);
  const canonical = `${site}t/${t.id}.html`;
  const title = `${t.name} 怎么样：价格、能力与替代方案 · AI Test Stack`;
  const desc = clip(`${t.name}（${t.vendor}）：${t.tagline}。月成本约 ${money(t.monthlyCost)}，${t.cnDirect ? '国内可直连' : '需境外网络'}。九维评分与相关套餐，数据核验于 ${t.verified}。`, 150);

  const scoreRows = Object.entries(t.score || {}).map(([k, v]) => {
    const c = (ctx.criteria || []).find(x => x.id === k);
    return `<tr><th>${esc(c ? c.name : k)}</th><td><span class="bar"><i style="width:${(v / 5) * 100}%"></i></span>${v} / 5</td></tr>`;
  }).join('');

  const planRows = own.length ? own.map(p => `<tr>
    <td><a href="${L.plan(p.id)}">${esc(p.name)}</a><br><span class="dim">${esc(p.tier)}</span></td>
    <td>${money(p.price)}<span class="dim">/月</span>${p.priceNote ? `<br><span class="dim">${esc(p.priceNote)}</span>` : ''}</td>
    <td>${esc(clip(p.quota, 46))}</td>
  </tr>`).join('') : '';

  const body = `
<h1>${esc(t.name)}</h1>
<p class="sub">${esc(t.vendor)} · ${esc(t.tagline)}</p>
<div>${(t.tags || []).map(x => `<span class="tag">${esc(x)}</span>`).join('')}</div>

<div class="facts">
  <div class="fact"><b>月成本（参考）</b><span>${money(t.monthlyCost)}</span></div>
  <div class="fact"><b>国内直连</b><span>${t.cnDirect ? '可以' : '需境外网络'}</span></div>
  <div class="fact"><b>可脚本化</b><span>${t.scriptable ? '是' : '否'}</span></div>
  <div class="fact"><b>许可</b><span>${esc(t.license)}</span></div>
  <div class="fact"><b>定价形态</b><span>${esc(t.pricing)}</span></div>
  <div class="fact"><b>数据核验</b><span>${esc(t.verified)}</span></div>
</div>

<h2>它是什么</h2>
<p>${esc(t.what)}</p>

<h2>适合谁</h2>
<p>${esc(t.fit)}</p>

<h2>常见用法</h2>
<p>${esc(t.use)}</p>

<h2>优点</h2>
${list(t.strengths)}

<h2>缺点与限制</h2>
${list(t.weaknesses)}
${t.risk ? `<p class="dim">风险提示：${esc(t.risk)}</p>` : ''}

<h2>九维评分</h2>
<p class="dim">评分是编辑判断，不是跑分，也不是厂商口径。依据见站内「数据源」页。</p>
<table>${scoreRows}</table>

${planRows ? `<h2>相关套餐</h2>
<table>
<tr><th>套餐</th><th>价格</th><th>额度</th></tr>
${planRows}
</table>` : ''}

${peers.length ? `<h2>同类工具</h2>
<table>
${peers.map(x => `<tr><td><a href="${L.tool(x.id)}">${esc(x.name)}</a></td><td class="dim">${esc(x.tagline)}</td><td>${money(x.monthlyCost)}/月</td></tr>`).join('')}
</table>` : ''}

<h2>数据来源</h2>
<p>官网：<a href="${esc(t.link)}" target="_blank" rel="noopener nofollow">${esc(t.link)}</a><br>
核验日期：${esc(t.verified)}${t.provenance ? ` · 来源等级：${esc(t.provenance)}` : ''}</p>

<a class="cta" href="${L.home}#tools">打开完整对比与筛选 →</a>
`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: t.name,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Windows, macOS, Linux, Web',
    description: clip(`${t.tagline}。${t.what}`, 300),
    url: canonical,
    offers: {
      '@type': 'Offer',
      price: String(t.monthlyCost || 0),
      priceCurrency: 'CNY',
      url: t.link
    },
    isPartOf: { '@type': 'WebSite', name: 'AI Test Stack', url: site }
  };

  return shell({
    title, desc, canonical, jsonLd, body, site, L,
    crumbs: [{ name: '工具索引', href: L.toolIndex }, { name: t.name }]
  });
}

/* ---------- 套餐页 ---------- */
function planPage(p, tool, plans, ctx) {
  const { site, L } = ctx;
  const canonical = `${site}p/${p.id}.html`;
  const title = `${p.name} ${p.tier} 多少钱：${money(p.price)}/月 · 额度与替代 · AI Test Stack`;
  const verdict = (p.verdict || '').trim();
  const desc = clip(`${p.name} ${p.tier}（${p.vendor}）：${money(p.price)}/月，${p.quota}。${verdict ? verdict + (/[。！？]$/.test(verdict) ? '' : '。') : ''}数据核验于 ${p.verified}。`, 150);

  /* 同价位替代：同形态、价格在 ±60% 内，按价格接近程度排 */
  const alt = plans
    .filter(x => x.id !== p.id && x.form === p.form && x.price > 0)
    .filter(x => Math.abs(x.price - p.price) <= Math.max(p.price * 0.6, 30))
    .sort((a, b) => Math.abs(a.price - p.price) - Math.abs(b.price - p.price))
    .slice(0, 6);

  const hist = (p.history || []).filter(h => h && h.date && typeof h.price === 'number');
  const histRows = hist.length ? hist.map(h => `<tr>
    <td>${esc(h.date)}</td><td>${money(h.price)}</td>
    <td class="dim">${esc(h.note || '')}${h.deltaPct != null && h.kind !== 'start' ? `（${h.deltaPct > 0 ? '+' : ''}${h.deltaPct}%）` : ''}</td>
  </tr>`).join('') : '';

  const body = `
<h1>${esc(p.name)} <span class="dim">${esc(p.tier)}</span></h1>
<p class="sub">${esc(p.vendor)} · ${esc(p.formName || p.form)}${p.scope ? ' · ' + esc(p.scope) : ''}</p>

<div class="price">
  <div class="n">${money(p.price)}<span style="font-size:16px;color:var(--dim)"> / 月</span></div>
  ${p.priceLocal != null && p.currency && p.currency !== 'CNY' ? `<div class="orig">标价 ${esc(p.currency)} ${p.priceLocal}，按站内汇率折人民币</div>` : ''}
  ${p.priceNote ? `<div class="note">${esc(p.priceNote)}</div>` : ''}
</div>

<div class="facts">
  <div class="fact"><b>计费形态</b><span>${esc(p.formName || p.form)}</span></div>
  <div class="fact"><b>额度口径</b><span>${esc(p.quotaUnit || '—')}</span></div>
  <div class="fact"><b>窗口</b><span>${esc(p.window || '—')}</span></div>
  <div class="fact"><b>超额</b><span>${esc(p.overage || '—')}</span></div>
  <div class="fact"><b>可用模型</b><span>${p.modelsCount != null ? p.modelsCount + ' 个' : '—'}</span></div>
  <div class="fact"><b>数据核验</b><span>${esc(p.verified)}</span></div>
</div>

<h2>额度</h2>
<p>${esc(p.quota)}</p>

<h2>可用模型</h2>
<p>${esc(p.models || '未记录')}</p>

<h2>支持的工具</h2>
<p>${esc(p.tools || '未记录')}</p>

<h2>优点</h2>
${list(p.pros)}

<h2>缺点</h2>
${list(p.cons)}
${p.risk ? `<p class="dim">风险提示：${esc(p.risk)}</p>` : ''}

${p.verdict ? `<h2>一句话结论</h2><p>${esc(p.verdict)}</p>` : ''}

${histRows ? `<h2>价格变动</h2>
<table><tr><th>日期</th><th>价格</th><th>说明</th></tr>${histRows}</table>` : ''}

${alt.length ? `<h2>同价位替代</h2>
<table><tr><th>套餐</th><th>价格</th><th>额度</th></tr>
${alt.map(x => `<tr><td><a href="${L.plan(x.id)}">${esc(x.name)}</a> <span class="dim">${esc(x.tier)}</span></td><td>${money(x.price)}/月</td><td class="dim">${esc(clip(x.quota, 40))}</td></tr>`).join('')}
</table>` : ''}

${tool ? `<h2>所属工具</h2><p><a href="${L.tool(tool.id)}">${esc(tool.name)}</a> — ${esc(tool.tagline)}</p>` : ''}

<h2>数据来源</h2>
<p>官网：<a href="${esc(p.link)}" target="_blank" rel="noopener nofollow">${esc(p.link)}</a><br>
核验日期：${esc(p.verified)}</p>

<a class="cta" href="${L.home}#plans?pk=${encodeURIComponent(p.id)}">在完整对比里看这一档 →</a>
`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${p.name} ${p.tier}`,
    description: clip(`${p.quota}。${p.verdict || ''}`, 300),
    brand: { '@type': 'Brand', name: p.vendor },
    url: canonical,
    offers: {
      '@type': 'Offer',
      price: String(p.price),
      priceCurrency: 'CNY',
      url: p.link,
      availability: 'https://schema.org/InStock'
    },
    isPartOf: { '@type': 'WebSite', name: 'AI Test Stack', url: site }
  };

  return shell({
    title, desc, canonical, jsonLd, body, site, L,
    crumbs: [{ name: '套餐索引', href: L.planIndex }, { name: `${p.name} ${p.tier}` }]
  });
}

/* ---------- 索引页 ---------- */
function toolIndex(tools, ctx) {
  const { site, L } = ctx;
  const rows = tools.slice().sort((a, b) => a.name.localeCompare(b.name, 'zh')).map(t =>
    `<tr><td><a href="${L.tool(t.id)}">${esc(t.name)}</a><br><span class="dim">${esc(t.vendor)}</span></td>
     <td class="dim">${esc(t.tagline)}</td>
     <td>${money(t.monthlyCost)}</td>
     <td>${t.cnDirect ? '直连' : '<span class="dim">需境外</span>'}</td></tr>`).join('');
  const body = `
<h1>工具索引</h1>
<p class="sub">${tools.length} 款 AI 工具，逐款有独立页面：定位、优缺点、九维评分、相关套餐与核验日期。</p>
<table><tr><th>工具</th><th>一句话</th><th>月成本</th><th>国内</th></tr>${rows}</table>
<a class="cta" href="${L.home}">回到完整对比站 →</a>`;
  return shell({
    title: `AI 工具索引：${tools.length} 款的价格、能力与适用场景 · AI Test Stack`,
    desc: `逐款列出 ${tools.length} 款 AI 编程与测试工具：定位、优缺点、九维评分、月成本、是否国内直连，以及每款对应的套餐价格。数据可下载核对。`,
    canonical: `${site}t/`, jsonLd: {
      '@context': 'https://schema.org', '@type': 'CollectionPage',
      name: 'AI 工具索引', url: `${site}t/`
    },
    body, site, L, crumbs: [{ name: '工具索引' }]
  });
}

function planIndex(plans, ctx) {
  const { site, L } = ctx;
  const forms = {};
  plans.forEach(p => { (forms[p.formName || p.form] = forms[p.formName || p.form] || []).push(p); });
  const sections = Object.keys(forms).map(k => {
    const rows = forms[k].slice().sort((a, b) => a.price - b.price).map(p =>
      `<tr><td><a href="${L.plan(p.id)}">${esc(p.name)}</a> <span class="dim">${esc(p.tier)}</span></td>
       <td>${money(p.price)}</td><td class="dim">${esc(clip(p.quota, 44))}</td></tr>`).join('');
    return `<h2>${esc(k)}（${forms[k].length} 档）</h2>
      <table><tr><th>套餐</th><th>价格</th><th>额度</th></tr>${rows}</table>`;
  }).join('');
  const body = `
<h1>套餐索引</h1>
<p class="sub">${plans.length} 档国内外套餐，按计费形态分组。每档有独立页面：额度、模型、工具白名单、价格历史与同价位替代。</p>
<p class="dim">四种计费形态的单位不能互相换算——请求次数、Credits、积分、共享额度池，跨形态比价会得出错误结论。</p>
${sections}
<a class="cta" href="${L.home}">回到完整对比站 →</a>`;
  return shell({
    title: `AI 编程套餐索引：${plans.length} 档价格与额度对照 · AI Test Stack`,
    desc: `${plans.length} 档国内外 AI 编程套餐：价格、额度口径、可用模型、工具白名单与价格变动历史。按订阅、按量、Token、会员四种形态分组。`,
    canonical: `${site}p/`, jsonLd: {
      '@context': 'https://schema.org', '@type': 'CollectionPage',
      name: 'AI 编程套餐索引', url: `${site}p/`
    },
    body, site, L, crumbs: [{ name: '套餐索引' }]
  });
}

/* ---------- 社区资源页 ----------
   收录的都是别人的开源项目，所以这一页的立场是「介绍 + 指路」，
   不是「评测」。评分、结论一律不写——我们没跑过人家的代码。 */
function resPage(it, stats, cats, ctx) {
  const { site, L } = ctx;
  const st = stats[it.repo] || {};
  const cat = cats.find(c => c.id === it.cat) || { name: it.cat };
  const canonical = `${site}c/${it.id}.html`;
  const title = `${it.name}：${cat.name} · 测试怎么用 · AI Test Stack`;
  const desc = clip(`${it.what} 测试场景：${it.use}`, 150);

  const facts = [
    ['仓库', `<a href="https://github.com/${esc(it.repo)}" target="_blank" rel="noopener">${esc(it.repo)}</a>`],
    ['分类', esc(cat.name)],
    ['Star', st.stars == null ? '未抓取' : Number(st.stars).toLocaleString('zh-CN')],
    ['最近提交', st.pushedAt ? esc(st.pushedAt) : '未抓取'],
    ['许可证', st.license ? esc(st.license) : '<span class="dim">仓库未标注</span>']
  ].map(([k, v]) => `<div class="fact"><b>${k}</b><span>${v}</span></div>`).join('');

  const body = `
<h1>${esc(it.name)}</h1>
<p class="sub">${esc(cat.name)} · ${esc(it.repo)}</p>
<div class="facts">${facts}</div>
<h2>这是什么</h2>
<p>${esc(it.what)}</p>
<h2>测试怎么用</h2>
<p>${esc(it.use)}</p>
${it.caveat ? `<h2>注意</h2><p>${esc(it.caveat)}</p>` : ''}
${(it.fits || []).length ? `<h2>配哪些工具</h2><p>${esc(it.fits.join(' / '))}</p>` : ''}
<p class="dim" style="margin-top:22px">星数与最近提交由脚本每周从 GitHub 抓取，抓取日 ${esc((stats.__updated || '—'))}。本页只做介绍，没有跑过该项目，不提供评分。</p>
<a class="cta" href="${L.resIndex}">看全部资源 →</a>`;
  return shell({
    title, desc, canonical,
    jsonLd: {
      '@context': 'https://schema.org', '@type': 'SoftwareSourceCode',
      name: it.name, description: it.what,
      codeRepository: `https://github.com/${it.repo}`,
      ...(st.license ? { license: `https://spdx.org/licenses/${st.license}.html` } : {})
    },
    body, site, L,
    crumbs: [{ name: '社区资源库', href: L.resIndex }, { name: it.name }]
  });
}

function resIndex(items, stats, cats, ctx) {
  const { site, L } = ctx;
  const sections = cats.map(c => {
    const rows = items.filter(x => x.cat === c.id).map(x => {
      const st = stats[x.repo] || {};
      return `<tr><td><a href="${L.res(x.id)}">${esc(x.name)}</a><br><span class="dim">${esc(x.repo)}</span></td>
        <td class="dim">${esc(x.what)}</td>
        <td>${st.stars == null ? '—' : Number(st.stars).toLocaleString('zh-CN')}</td>
        <td class="dim">${esc(st.pushedAt || '—')}</td></tr>`;
    }).join('');
    return `<h2>${esc(c.name)}（${items.filter(x => x.cat === c.id).length}）</h2>
      <p class="dim">${esc(c.desc)}</p>
      <table><tr><th>项目</th><th>是什么</th><th>Star</th><th>最近提交</th></tr>${rows}</table>`;
  }).join('');
  const body = `
<h1>社区资源库</h1>
<p class="sub">${items.length} 个测试工程师用得上的开源项目，按「装到哪个环节」分 ${cats.length} 类。星数与最近提交由脚本每周从 GitHub 抓取。</p>
${sections}
<a class="cta" href="${L.home}">回到完整对比站 →</a>`;
  return shell({
    title: `社区资源库：${items.length} 个测试工程师用得上的开源项目 · AI Test Stack`,
    desc: `${items.length} 个与 AI 辅助测试相关的开源项目：MCP Server、Agent Skill、AI 测试工具与测试基建。每项写明是什么、测试怎么用、坑在哪，星数每周自动刷新。`,
    canonical: `${site}c/`, jsonLd: {
      '@context': 'https://schema.org', '@type': 'CollectionPage',
      name: '社区资源库', url: `${site}c/`
    },
    body, site, L, crumbs: [{ name: '社区资源库' }]
  });
}

/* ---------- 主入口 ---------- */
function generate(outDir, base, home) {
  const tools = read('tools.json');
  const plans = read('plans.json');
  const meta = read('meta.json');
  const criteria = read('criteria.json').criteria || [];
  const community = readSafe('community.json', { categories: [], items: [] });
  const statsRaw = readSafe('community-stats.json', { updated: null, repos: {} });
  const stats = Object.assign({ __updated: statsRaw.updated || '—' }, statsRaw.repos || {});
  const cats = community.categories || [];
  const items = community.items || [];
  const ctxT = { site: home, L: linker('t'), criteria };
  const ctxP = { site: home, L: linker('p'), criteria };
  const ctxC = { site: home, L: linker('c'), criteria };

  const pages = [];   // { loc, lastmod, priority, changefreq }
  const write = (rel, html, metaInfo) => {
    const abs = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, html, 'utf8');
    pages.push(metaInfo);
  };

  write('t/index.html', toolIndex(tools, ctxT), {
    loc: `${home}t/`, lastmod: meta.lastVerified, priority: '0.8', changefreq: 'weekly'
  });
  write('p/index.html', planIndex(plans, ctxP), {
    loc: `${home}p/`, lastmod: meta.lastVerified, priority: '0.8', changefreq: 'weekly'
  });

  for (const t of tools) {
    write(`t/${t.id}.html`, toolPage(t, plans, tools, ctxT), {
      loc: `${home}t/${t.id}.html`, lastmod: t.verified || meta.lastVerified,
      priority: '0.7', changefreq: 'monthly'
    });
  }
  for (const p of plans) {
    const tool = tools.find(t => t.id === p.toolId) || null;
    write(`p/${p.id}.html`, planPage(p, tool, plans, ctxP), {
      loc: `${home}p/${p.id}.html`, lastmod: p.verified || meta.lastVerified,
      priority: '0.7', changefreq: 'weekly'
    });
  }
  /* 社区资源：每条一个地址。这一层是 0.9.2 新增的，
     和工具/套餐页同理——「Playwright MCP 怎么用」这种词得有自己的落地页。 */
  if (items.length) {
    write('c/index.html', resIndex(items, stats, cats, ctxC), {
      loc: `${home}c/`, lastmod: statsRaw.updated || meta.lastVerified,
      priority: '0.8', changefreq: 'weekly'
    });
    for (const it of items) {
      write(`c/${it.id}.html`, resPage(it, stats, cats, ctxC), {
        loc: `${home}c/${it.id}.html`,
        lastmod: (stats[it.repo] && stats[it.repo].pushedAt) || statsRaw.updated || meta.lastVerified,
        priority: '0.6', changefreq: 'monthly'
      });
    }
  }
  return pages;
}

module.exports = { generate };

if (require.main === module) {
  const { detect } = require('./site-base');
  const { base, url } = detect();
  const out = path.join(ROOT, '_site');
  const pages = generate(out, base, url);
  console.log(`生成 ${pages.length} 个静态页：t/ 与 p/ 各含索引页`);
}
