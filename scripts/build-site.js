#!/usr/bin/env node
/* 生成可发布的静态目录 _site/ —— GitHub Pages 托管的就是这里面的内容。
   本地也能跑，用来预览「部署后的样子」（子路径 + http，和 file:// 双击打开略有差异）。

   用法：
     node scripts/build-site.js
     PAGES_BASE=/my-repo node scripts/build-site.js     # 手动指定子路径
   子路径默认从 git remote origin 的仓库名推出来；没有 remote 就按根路径。 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '_site');

function detectBase() {
  if (process.env.PAGES_BASE !== undefined) return process.env.PAGES_BASE.replace(/\/$/, '');
  try {
    const url = execSync('git remote get-url origin', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
    const m = url.match(/[/:]([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (m) {
      const owner = m[1], repo = m[2];
      // 用户/组织主页仓库（owner.github.io）发布在根路径，其它仓库在 /<repo> 下
      return repo.toLowerCase() === owner.toLowerCase() + '.github.io' ? '' : '/' + repo;
    }
  } catch (e) { /* 没有 remote：按根路径，本地预览用 */ }
  return '';
}

const base = detectBase();

// 1) 清空重建
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// 2) 页面本体
fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(OUT, 'index.html'));

// 3) 数据集：页面上的下载链接指向 exports/*，必须一起发布
const copied = ['index.html'];
for (const dir of ['exports']) {
  const src = path.join(ROOT, dir);
  if (fs.existsSync(src)) {
    fs.cpSync(src, path.join(OUT, dir), { recursive: true });
    for (const f of fs.readdirSync(src)) copied.push(dir + '/' + f);
  }
}

// 4) 访客协议与 404
fs.writeFileSync(path.join(OUT, 'robots.txt'),
  'User-agent: *\nAllow: /\n', 'utf8');
copied.push('robots.txt');

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

// 5) 关掉 Pages 的 Jekyll 处理（下划线开头的文件不会被吃掉）
fs.writeFileSync(path.join(OUT, '.nojekyll'), '', 'utf8');

const bytes = copied.reduce((n, f) => n + fs.statSync(path.join(OUT, f)).size, 0);
console.log(JSON.stringify({
  base: base || '(根路径)',
  out: path.relative(ROOT, OUT).split(path.sep).join('/'),
  files: copied.length + 1,
  sizeKB: Math.round(bytes / 1024),
  index: copied[0]
}, null, 2));
