#!/usr/bin/env node
/* =========================================================
   换域名 · 一条命令
   ---------------------------------------------------------
   用法：
     npm run domain -- aiteststack.com        # 绑定域名
     npm run domain -- --check                # 检查域名解析好了没
     npm run domain -- --off                  # 退回 github.io 地址

   它做什么：
     1. 把域名写进仓库根的 CNAME（GitHub Pages 认这个文件）
     2. 打印该去 DNS 后台加哪几条记录
     3. --check 会真的去查 DNS 和 HTTPS，告诉你还差什么

   它不做什么：买域名、改 DNS。那两步只有你能做。
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;
const https = require('https');

const ROOT = path.join(__dirname, '..');
const CNAME = path.join(ROOT, 'CNAME');

const GITHUB_A = ['185.199.108.153', '185.199.109.153', '185.199.110.153', '185.199.111.153'];

const C = {
  dim: s => '\x1b[2m' + s + '\x1b[0m',
  bold: s => '\x1b[1m' + s + '\x1b[0m',
  green: s => '\x1b[32m' + s + '\x1b[0m',
  yellow: s => '\x1b[33m' + s + '\x1b[0m',
  red: s => '\x1b[31m' + s + '\x1b[0m'
};

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const OFF = args.includes('--off');
const domain = args.find(a => !a.startsWith('--'));

function repoSlug() {
  try {
    const url = require('child_process').execSync('git remote get-url origin', {
      cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore']
    }).toString().trim();
    const m = url.match(/[/:]([^/]+)\/([^/]+?)(?:\.git)?$/);
    return m ? `${m[1]}/${m[2]}` : '';
  } catch (e) { return ''; }
}

/* 查 DNS + HTTPS：域名到底通没通，不靠猜 */
async function check(d) {
  console.log(C.bold(`\n检查 ${d}\n`));

  let ok = true;
  try {
    const a = await dns.resolve4(d);
    const hit = a.filter(x => GITHUB_A.includes(x));
    if (hit.length) console.log(C.green(`  ✓ A 记录指向 GitHub Pages（${hit.join(', ')}）`));
    else { console.log(C.red(`  ✗ A 记录是 ${a.join(', ')}，不是 GitHub Pages 的地址`)); ok = false; }
  } catch (e) {
    console.log(C.red('  ✗ 解析不到 A 记录：' + e.code));
    ok = false;
  }

  try {
    const c = await dns.resolveCname('www.' + d).catch(() => []);
    if (c.length) console.log(C.dim(`  · www 指向 ${c.join(', ')}`));
  } catch (e) { /* 没有 www 不算错 */ }

  const code = await new Promise(res => {
    const req = https.get(`https://${d}/`, { timeout: 15000 }, r => { r.resume(); res(r.statusCode); });
    req.on('error', () => res(0));
    req.on('timeout', () => { req.destroy(); res(0); });
  });
  if (code === 200) console.log(C.green('  ✓ HTTPS 返回 200'));
  else if (code) console.log(C.yellow(`  · HTTPS 返回 ${code}（证书可能还在签，GitHub 要几分钟到几小时）`));
  else { console.log(C.yellow('  · HTTPS 还连不上（DNS 没生效，或证书没签好）')); ok = false; }

  console.log(ok
    ? C.green('\n域名已经通了。\n')
    : C.yellow('\n还没完全通。DNS 生效一般 10 分钟到 24 小时，等等再跑一次 --check。\n'));
  process.exit(ok ? 0 : 1);
}

(async () => {
  if (OFF) {
    if (fs.existsSync(CNAME)) { fs.unlinkSync(CNAME); console.log('已删除 CNAME，退回 github.io 地址。'); }
    else console.log('本来就没有 CNAME。');
    console.log(C.dim('记得跑 npm run check 并推送，线上才会换回去。'));
    return;
  }

  if (CHECK) {
    const cur = fs.existsSync(CNAME) ? fs.readFileSync(CNAME, 'utf8').trim() : '';
    if (!cur) { console.error('还没有绑定域名。先跑：npm run domain -- 你的域名'); process.exit(1); }
    return check(cur);
  }

  if (!domain) {
    console.log('用法：npm run domain -- 你的域名');
    console.log('      npm run domain -- --check');
    console.log('      npm run domain -- --off');
    process.exit(1);
  }

  const d = domain.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) {
    console.error('这不像一个域名：' + d + '（要写成 example.com，不要带 https:// 和路径）');
    process.exit(1);
  }

  fs.writeFileSync(CNAME, d + '\n', 'utf8');

  const slug = repoSlug();
  console.log(C.bold(`\n已把 ${d} 写进 CNAME。\n`));

  console.log(C.bold('接下来两步，都在你买域名的那个后台做：\n'));
  console.log(C.bold('1) 加 DNS 记录'));
  console.log(`   类型 A    主机 @      值 ${GITHUB_A[0]}`);
  for (const ip of GITHUB_A.slice(1)) console.log(`   类型 A    主机 @      值 ${ip}`);
  console.log(`   类型 CNAME 主机 www   值 ${slug ? slug.split('/')[0] + '.github.io' : '你的用户名.github.io'}`);
  console.log(C.dim('   四条 A 记录是 GitHub Pages 的固定地址，少一条也能用，但建议都加。'));

  console.log(C.bold('\n2) 回 GitHub 仓库设置里绑一次'));
  console.log(`   ${slug ? 'https://github.com/' + slug + '/settings/pages' : '仓库 Settings → Pages'}`);
  console.log('   Custom domain 填同一个域名 → Save');
  console.log('   等它显示 "DNS check successful" 后，勾上 Enforce HTTPS');

  console.log(C.bold('\n3) 回来发布'));
  console.log('   npm run check');
  console.log('   git add CNAME && git commit -m "chore: 绑定域名 ' + d + '"');
  console.log('   git push');

  console.log(C.dim('\nDNS 生效后跑一次：npm run domain -- --check'));
  console.log(C.dim('换域名后 canonical / sitemap / feed 会自动跟着变，不用改代码。\n'));
})();
