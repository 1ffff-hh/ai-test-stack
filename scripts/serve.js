#!/usr/bin/env node
/* 本地预览：用 http 把 _site/ 端起来，模拟 GitHub Pages 的访问方式。
   有 _site/ 就服务它，没有就直接服务仓库根目录。
   用法：node scripts/serve.js [端口]        默认 4173 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, '_site');
const DIR = fs.existsSync(path.join(SITE, 'index.html')) ? SITE : ROOT;
const PORT = Number(process.argv[2] || process.env.PORT || 4173);

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
  console.log('预览地址：http://localhost:' + PORT + '/');
  console.log('服务目录：' + rel + (rel === '_site' ? '（发布产物，与 Pages 一致）' : '（仓库根目录）'));
  console.log('按 Ctrl+C 停止。');
});
