#!/usr/bin/env node
/* 站点身份：owner / repo / 子路径 / 绝对地址。
   build.js、build-site.js、build-feed.js、build-og.js 都要用到同一套值——
   分散在三处各推一次，迟早会出现「canonical 指向 A、feed 里的链接指向 B」。

   推导顺序：环境变量 → git remote origin → 本地相对路径（没有 remote 时）。
   本地没有 remote 不报错：站点本来就该能在 file:// 下双击打开。 */
'use strict';
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

function detect() {
  let owner = process.env.SITE_OWNER || '';
  let repo = process.env.SITE_REPO || '';

  if (!repo) {
    try {
      const url = execSync('git remote get-url origin', {
        cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore']
      }).toString().trim();
      const m = url.match(/[/:]([^/]+)\/([^/]+?)(?:\.git)?$/);
      if (m) { owner = owner || m[1]; repo = m[2]; }
    } catch (e) { /* 没有 remote：按本地处理 */ }
  }

  // 用户/组织主页仓库（owner.github.io）发布在根路径，其它仓库在 /<repo> 下
  const isUserSite = repo && owner && repo.toLowerCase() === owner.toLowerCase() + '.github.io';
  let base = process.env.PAGES_BASE !== undefined
    ? process.env.PAGES_BASE.replace(/\/$/, '')
    : (repo ? (isUserSite ? '' : '/' + repo) : '');

  const host = owner ? `https://${owner}.github.io` : '';
  return {
    owner,
    repo,
    base,                                   // '' 或 '/ai-test-stack'
    url: host + base + '/',                 // 站点首页绝对地址；无 remote 时为 '/'
    repoUrl: owner && repo ? `https://github.com/${owner}/${repo}` : '',
    isRemote: !!(owner && repo)
  };
}

module.exports = { detect, ROOT };

if (require.main === module) {
  console.log(JSON.stringify(detect(), null, 2));
}
