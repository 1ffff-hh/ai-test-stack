#!/usr/bin/env node
/* 生成可发布的静态目录 _site/ —— GitHub Pages 托管的就是这里面的内容。
   本地也能跑，用来预览「部署后的样子」（子路径 + http，和 file:// 双击打开略有差异）。

   产物清单：index.html、exports/、404.html、robots.txt、sitemap.xml、
             feed.xml（build-feed.js）、sw.js（离线缓存）、og.png（build-og.js，失败不阻塞）

   用法：
     node scripts/build-site.js
     PAGES_BASE=/my-repo node scripts/build-site.js     # 手动指定子路径
     SKIP_OG=1 node scripts/build-site.js               # 跳过社媒图（不想起浏览器时） */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { detect, ROOT } = require('./site-base');

const OUT = path.join(ROOT, '_site');
const { base, url, repoUrl, isRemote } = detect();

// 1) 清空重建
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const copied = [];
const problems = [];
const skipped = [];

// 2) 页面本体
fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(OUT, 'index.html'));
copied.push('index.html');

// 3) 数据集：页面上的下载链接指向 exports/*，必须一起发布
const exportFiles = [];
for (const dir of ['exports']) {
  const src = path.join(ROOT, dir);
  if (!fs.existsSync(src)) { problems.push('缺少 ' + dir + '/：页面上的下载链接会 404（先跑 node build.js）'); continue; }
  fs.cpSync(src, path.join(OUT, dir), { recursive: true });
  for (const f of fs.readdirSync(src)) { copied.push(dir + '/' + f); exportFiles.push(dir + '/' + f); }
}

// 4) 访客协议 + 站点地图
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${url}</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), sitemap, 'utf8');
copied.push('sitemap.xml');

fs.writeFileSync(path.join(OUT, 'robots.txt'),
  `User-agent: *\nAllow: /\n${isRemote ? 'Sitemap: ' + url + 'sitemap.xml\n' : ''}`, 'utf8');
copied.push('robots.txt');

// 5) 404：Pages 用根目录的 404.html 兜住未知路径，这里把它送回首页
fs.writeFileSync(path.join(OUT, '404.html'), `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>404 · 没有这个页面</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<script>location.replace(${JSON.stringify(base + '/')});</script>
<style>body{background:#070b12;color:#d6e0ef;font:16px/1.7 system-ui,-apple-system,"Segoe UI",sans-serif;
display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px}
a{color:#22d3ee}</style></head>
<body><p>这个地址没有对应页面，正在回到首页……<br>如果没有自动跳转，<a href="${base}/">点这里</a>。</p></body></html>
`, 'utf8');
copied.push('404.html');

// 6) 关掉 Pages 的 Jekyll 处理（下划线开头的文件不会被吃掉）
fs.writeFileSync(path.join(OUT, '.nojekyll'), '', 'utf8');

/* 7) Service Worker：让「可离线打开」这个说法在网页版上也成立（不只是 file://）。
   缓存版本号带上构建日期，新版本一上线旧缓存自动作废；
   导航请求走 network-first（宁可慢一点也要拿新版），静态资源走 stale-while-revalidate。 */
const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'meta.json'), 'utf8'));
const CACHE = `ats-${meta.version || '0'}-${meta.lastBuilt || '0'}`;

/* 9.5) llms.txt：给 AI 代理读的站点说明书。
   2026 年同类站（llmrates、models.dev、pricepertoken）都被接进代理/IDE，
   一个纯静态站想被引用，就得有一份机器能直接吃下的入口。
   里面的数字全部从 data/ 现算，遵守「页面上的计数不写死」这条站规。 */
const readJson = (rel) => {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch (e) { return null; }
};
const cnt = (rel, fallback) => {
  const j = readJson(rel);
  if (Array.isArray(j)) return j.length;
  if (j && Array.isArray(j.items)) return j.items.length;
  return fallback;
};
const dTools = readJson('data/tools.json') || [];
const dPlans = readJson('data/plans.json') || [];
const dBundles = readJson('data/bundles.json') || [];
const dNews = readJson('data/news.json') || [];
const dNewsAuto = readJson('data/news-auto.json') || [];
const dChangelog = readJson('data/changelog.json') || [];
const dRoles = readJson('data/roles.json') || [];
const dEval = readJson('data/evalset.json') || [];
const n = (x, fb) => (Array.isArray(x) ? x.length : fb);
const llms = `# AI Test Stack

> 给测试工程师的 AI 工具与套餐选型决策站。单文件、零后端、零第三方请求，可离线打开。
> 版本 ${meta.version} ｜ 数据核验日 ${meta.lastVerified} ｜ 许可 MIT（代码与数据同许可）

## 这个站回答四个问题
- 买什么：${n(dTools, 0)} 款工具 × ${n(dPlans, 0)} 档套餐 × ${n(dBundles, 0)} 套组合，每个价格带出处与核验日，每个分数署编辑的名
- 我在哪：${n(dRoles, 0)} 个测试角色阶梯、能力图谱、AI 测试专项与 ${n(dEval, 0)} 个评测集
- 行业在变什么：${n(dNews, 0) + n(dNewsAuto, 0)} 条大事与对测试岗位的具体冲击
- 下一步：30 天落地执行包，以及可打印成 A4 的决策报告

## 机器可读数据（本仓库 exports/，线上同路径）
- exports/tools.json — 工具档案：九维评分、来源等级、适配模型、工具白名单
- exports/plans.json — 套餐档位：价格、额度口径、核验日、形态、限制
- exports/plans.csv — 同上的表格版
- exports/plans-history.csv · plans-history.json — 价格时间序列
- exports/evalset.json — 评测集清单
- exports/manifest.json — 本次导出的清单与计数
- feed.xml — 更新订阅源（${n(dChangelog, 0)} 条）

## 使用约束（引用本站数据时请一并保留）
- 所有价格是公开页面核验值，市场变动极快，下单前以厂商官网为准。
- 评分是编辑判断，不是跑分，不是厂商口径。
- 四种订阅形态的计费单位不可互相换算（请求次数 / Credits / AFP 积分 / 共享额度池），跨形态比价会得出错误结论。
- 本站不收集任何信息：无后端、无 cookie、无统计，用户数据只存在其浏览器 localStorage。
`;
fs.writeFileSync(path.join(OUT, 'llms.txt'), llms, 'utf8');
copied.push('llms.txt');

const precache = ['.', 'index.html', 'sitemap.xml', '404.html', 'llms.txt', ...exportFiles];
fs.writeFileSync(path.join(OUT, 'sw.js'), `/* 由 scripts/build-site.js 生成，不要手改。 */
const CACHE = ${JSON.stringify(CACHE)};
const PRECACHE = ${JSON.stringify(precache)};
const OFFLINE = ${JSON.stringify(base + '/')};

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // 单个文件失败不能让整个安装失败，否则一个 404 就永远没有离线能力
    await Promise.all(PRECACHE.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin !== location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        const c = await caches.open(CACHE);
        c.put(req, res.clone());
        return res;
      } catch (err) {
        return (await caches.match(req)) || (await caches.match('index.html')) || Response.error();
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const hit = await caches.match(req);
    const net = fetch(req).then(res => {
      if (res && res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
      return res;
    }).catch(() => hit);
    return hit || net;
  })());
});
`, 'utf8');
copied.push('sw.js');

/* 8) 订阅源：站每周都在变，没有 feed 就没有回访钩子 */
try {
  const r = execFileSync(process.execPath, [path.join(__dirname, 'build-feed.js')], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe']
  }).toString();
  const info = JSON.parse(r);
  copied.push('feed.xml');
  console.log('  feed.xml：' + info.entries + ' 条（' + info.latest + '）');
} catch (e) {
  problems.push('feed.xml 生成失败：' + String(e.stderr || e.message).trim().split('\n')[0]);
}

/* 9) 社媒分享图：聊天窗口里的第一印象。
   要起真浏览器渲染，本地没装 Playwright 就跳过（页面照发，只是分享卡没图）。 */
if (process.env.SKIP_OG) {
  skipped.push('og.png（SKIP_OG=1）');
} else {
  try {
    const r = execFileSync(process.execPath, [path.join(__dirname, 'build-og.js')], {
      cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000
    }).toString();
    const info = JSON.parse(r);
    copied.push('og.png');
    console.log('  og.png：' + info.w + '×' + info.h + '，' + info.kb + ' KB');
  } catch (e) {
    skipped.push('og.png（' + String(e.stderr || e.message).trim().split('\n')[0] + '）');
  }
}

// 10) 自检：产物不全就别让工作流继续往下走到部署那一步
for (const need of ['index.html', 'exports/plans.json', 'exports/plans.csv', '404.html', 'sitemap.xml', 'llms.txt']) {
  if (!fs.existsSync(path.join(OUT, need))) problems.push('产物缺失：' + need);
}
const idx = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
for (const [what, pat] of [['canonical', /rel="canonical"/], ['og:image', /property="og:image"/], ['JSON-LD', /application\/ld\+json/]]) {
  if (!pat.test(idx)) problems.push('index.html 里没有 ' + what + '（先跑 node build.js，且 build.js 要能识别站点地址）');
}
if (isRemote && !new RegExp(repoUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(idx)) {
  problems.push('index.html 里没有指向 ' + repoUrl + ' 的纠错入口（检查 git remote origin）');
}

const bytes = copied.reduce((n, f) => n + fs.statSync(path.join(OUT, f)).size, 0);
const report = {
  base: base || '(根路径)',
  url,
  out: path.relative(ROOT, OUT).split(path.sep).join('/'),
  files: copied.length + 1,
  sizeKB: Math.round(bytes / 1024),
  skipped,
  problems
};
console.log(JSON.stringify(report, null, 2));
if (problems.length) {
  console.error('\n_site 自检失败：');
  problems.forEach(p => console.error('  · ' + p));
  process.exit(1);
}
if (skipped.length) console.warn('\n⚠ 跳过：' + skipped.join('；'));
