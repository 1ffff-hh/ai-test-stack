#!/usr/bin/env node
/* 本地预览：用 http 把 _site/ 端起来，模拟 GitHub Pages 的访问方式。
   有 _site/ 就服务它，没有就直接服务仓库根目录。

   **必须带上子路径**：线上是 https://<user>.github.io/<repo>/，不是根路径。
   在根路径预览，相对链接、404、Service Worker 的作用域全都和线上不一样——
   那样预览就只是「看起来像」，不解决问题。

   用法：node scripts/serve.js [端口]        默认 4173 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { detect } = require('./site-base');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, '_site');
const DIR = fs.existsSync(path.join(SITE, 'index.html')) ? SITE : ROOT;
const PORT = Number(process.argv[2] || process.env.PORT || 4173);
const BASE = detect().base;          // '' 或 '/ai-test-stack'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8'
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);

  if (BASE) {
    // 根路径 → 跳到子路径，和 Pages 的行为一致
    if (p === '/') { res.writeHead(302, { location: BASE + '/' }).end(); return; }
    if (p === BASE) { res.writeHead(301, { location: BASE + '/' }).end(); return; }
    if (!p.startsWith(BASE + '/')) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
        .end('404 ' + p + '\n这个站发布在 ' + BASE + '/ 下，根路径没有内容。');
      return;
    }
    p = p.slice(BASE.length);
  }

  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(DIR, p));
  if (!file.startsWith(DIR)) { res.writeHead(403).end('forbidden'); return; }

  fs.readFile(file, (err, buf) => {
    if (err) {
      fs.readFile(path.join(DIR, '404.html'), (e2, b2) => {
        if (e2) res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404 ' + p);
        else res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' }).end(b2);
      });
      return;
    }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store'
    });
    res.end(buf);
  });
}).listen(PORT, () => {
  const rel = path.relative(ROOT, DIR).split(path.sep).join('/') || '.';
  console.log('预览地址：http://localhost:' + PORT + BASE + '/');
  if (!BASE) console.log('（没有 git remote，按根路径服务；线上会是子路径）');
  console.log('服务目录：' + rel + (rel === '_site' ? '（发布产物，与 Pages 一致）' : '（仓库根目录）'));
  console.log('按 Ctrl+C 停止。');
});
