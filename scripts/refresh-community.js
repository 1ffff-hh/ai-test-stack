#!/usr/bin/env node
/* =========================================================
   社区资源库 · 星数与活跃度自动刷新
   ---------------------------------------------------------
   用法：
     node scripts/refresh-community.js            # 抓一遍，写 data/community-stats.json
     node scripts/refresh-community.js --dry      # 只打印，不落盘
     node scripts/refresh-community.js --offline  # 不联网，只检查现有文件新不新

   为什么要有这个脚本：
     data/community.json 里只写「人工判断」——这是什么、对测试怎么用。
     「多少星、最近一次提交、什么许可证」这三样会变，手抄一定会过期，
     所以交给脚本从 GitHub REST API 抓，每周 CI 跑一次。
     抓到的东西单独放 community-stats.json，人工文件永远不被覆盖。

   失败策略：
     单个仓库失败不影响其它仓库，旧值原样保留；
     整轮全失败（限流 / 断网）就不写文件，退出码 1，让 CI 红给你看。
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const SRC = path.join(DATA, 'community.json');
const OUT = path.join(DATA, 'community-stats.json');

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const OFFLINE = args.includes('--offline');

const readJSON = (p, fb) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; } };
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/* token 只从环境或本机 gh 取，绝不写进任何文件。
   CI 里用 secrets.GITHUB_TOKEN；本机已 gh auth login 的话直接复用。 */
function token() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  try {
    return execFileSync('gh', ['auth', 'token'], {
      stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000
    }).toString().trim();
  } catch (e) { return ''; }
}

function api(url, tok, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const headers = {
      'user-agent': 'AITestStackBot/1.0 (+community-stats)',
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28'
    };
    if (tok) headers.authorization = 'Bearer ' + tok;
    let settled = false;
    const done = (fn, v) => { if (!settled) { settled = true; fn(v); } };
    const req = https.get(url, { headers, timeout }, res => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', c => { if (buf.length < 1e6) buf += c; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try { done(resolve, JSON.parse(buf)); } catch (e) { done(reject, new Error('JSON 解析失败')); }
        } else if (res.statusCode === 404) {
          done(reject, new Error('仓库不存在或已改名'));
        } else if (res.statusCode === 403 || res.statusCode === 429) {
          const left = res.headers['x-ratelimit-remaining'];
          done(reject, new Error(`被限流（剩余 ${left == null ? '?' : left}）`));
        } else {
          done(reject, new Error('HTTP ' + res.statusCode));
        }
      });
      res.on('error', e => done(reject, e));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', e => done(reject, e));
  });
}

const LICENSE_ALIAS = {
  'Apache License 2.0': 'Apache-2.0',
  'MIT License': 'MIT',
  'BSD 3-Clause "New" or "Revised" License': 'BSD-3-Clause',
  'GNU Affero General Public License v3.0': 'AGPL-3.0',
  'GNU General Public License v3.0': 'GPL-3.0',
  'Creative Commons Zero v1.0 Universal': 'CC0-1.0'
};

(async () => {
  const src = readJSON(SRC, null);
  if (!src || !Array.isArray(src.items)) {
    console.error('读不到 data/community.json，或 items 不是数组');
    process.exit(1);
  }
  const prev = readJSON(OUT, { repos: {} }) || { repos: {} };
  const repos = [...new Set(src.items.map(x => x.repo).filter(Boolean))];

  if (OFFLINE) {
    const st = prev.updated || '';
    const age = st ? Math.round((Date.now() - Date.parse(st + 'T00:00:00Z')) / 86400000) : null;
    console.log(JSON.stringify({
      offline: true, repos: repos.length, updated: st || null, ageDays: age,
      stale: age == null || age > 14,
      note: age == null ? '还没抓过：先跑 node scripts/refresh-community.js' : `上次抓取 ${age} 天前`
    }, null, 2));
    process.exit(age == null || age > 14 ? 1 : 0);
  }

  const tok = token();
  if (!tok) console.warn('⚠ 没有 GitHub token：按未认证限流（60 次/小时）跑，仓库多时可能中途失败');

  const out = { updated: today(), source: 'GitHub REST API', repos: {} };
  const failed = [];
  let done = 0;

  for (const repo of repos) {
    try {
      const j = await api('https://api.github.com/repos/' + repo, tok);
      const lic = (j.license && (j.license.spdx_id || j.license.name)) || '';
      out.repos[repo] = {
        stars: j.stargazers_count,
        pushedAt: String(j.pushed_at || '').slice(0, 10),
        license: lic === 'NOASSERTION' ? '' : (LICENSE_ALIAS[lic] || lic),
        archived: !!j.archived,
        desc: String(j.description || '').slice(0, 140)
      };
      done++;
      process.stdout.write('.');
    } catch (e) {
      failed.push({ repo, error: e.message });
      // 旧值保留：一次限流不应该让页面上的星数变成 0
      if (prev.repos && prev.repos[repo]) out.repos[repo] = prev.repos[repo];
      process.stdout.write('x');
    }
  }
  process.stdout.write('\n');

  if (!done) {
    console.error('全部仓库都抓失败了，不写文件。第一个错误：' + (failed[0] ? failed[0].error : '未知'));
    process.exit(1);
  }

  const report = {
    repos: repos.length,
    ok: done,
    failed: failed.length,
    updated: out.updated,
    ...(failed.length ? { failures: failed.slice(0, 5) } : {})
  };

  if (DRY) {
    console.log(JSON.stringify({ dry: true, ...report }, null, 2));
    return;
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n', 'utf8');
  console.log(JSON.stringify(report, null, 2));
})();
