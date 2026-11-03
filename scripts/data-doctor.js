#!/usr/bin/env node
/* =========================================================
   数据维护 · 一条命令走完
   ---------------------------------------------------------
   用法：
     npm run data               # 联网核价 → 逐条问你要不要改 → 门禁 → 问你要不要发
     npm run data -- --check    # 只看，不改、不发
     npm run data -- --yes      # 全部按官网价更新，不再逐条问
     npm run data -- --no-push  # 改完跑门禁，但不提交不推送

   它替你做的：
     1. 打开 29 个官网定价页，按规则把价格读出来
     2. 和库里的价一比，列出「库内 X → 官网 Y」
     3. 你按 y 就改（自动算汇率、写历史、更新核验日）
     4. 改完跑五道门禁
     5. 全绿才问要不要提交推送

   它不会做的：改文案、改评分、猜促销价。那些要人判断。
   ========================================================= */
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = path.join(__dirname, '..');
const CHECK_ONLY = process.argv.includes('--check');
const AUTO_YES = process.argv.includes('--yes');
const NO_PUSH = process.argv.includes('--no-push');
/* --reuse：不重新抓官网，直接用上次的 data/_price-check.json。
   门禁没过、改完想重跑时用，省掉两分钟抓取。 */
const REUSE = process.argv.includes('--reuse');
const today = new Date().toISOString().slice(0, 10);

const C = {
  dim: s => '\x1b[2m' + s + '\x1b[0m',
  bold: s => '\x1b[1m' + s + '\x1b[0m',
  green: s => '\x1b[32m' + s + '\x1b[0m',
  yellow: s => '\x1b[33m' + s + '\x1b[0m',
  red: s => '\x1b[31m' + s + '\x1b[0m'
};

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { cwd: ROOT, shell: process.platform === 'win32', ...opts });
}

function ask(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, a => { rl.close(); resolve(a.trim().toLowerCase()); });
  });
}

function readJSON(p, fb) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')); } catch (e) { return fb; }
}

(async () => {
  console.log(C.bold('\n=== 数据维护 ===\n'));

  /* ---------- 1. 联网核价 ---------- */
  if (REUSE) {
    console.log(C.dim('--reuse：跳过抓取，直接用上次的核价结果。\n'));
  } else {
    console.log(C.dim('正在打开官网核价，大约 1–2 分钟…\n'));
    run(process.execPath, ['scripts/parse-pricing.js']);
  }

  const check = readJSON('data/_price-check.json', null);
  if (!check) {
    console.log(C.red('没拿到核价结果，先单独跑一次：node scripts/parse-pricing.js'));
    process.exit(1);
  }

  const mismatch = (check.items || []).filter(x => x.status === 'mismatch');
  const broken = (check.items || []).filter(x => ['parse-fail', 'fetch-fail', 'no-fixture'].includes(x.status));

  console.log('');
  console.log(`  一致 ${C.green(check.ok)} · 要改 ${mismatch.length ? C.yellow(mismatch.length) : 0} · 解析失败 ${broken.length ? C.yellow(broken.length) : 0}`);

  if (broken.length) {
    console.log('\n' + C.yellow('这些页面没读出来（规则要修，或官网改版了）：'));
    for (const b of broken) console.log(`  · ${b.source}${b.planId !== '-' ? '/' + b.planId : ''}  ${b.why}`);
    console.log(C.dim('  处理办法见 docs/MAINTAIN.md「解析失败」一节。'));
  }

  if (!mismatch.length) {
    console.log('\n' + C.green('没有需要改的价格，可以收工了。'));
    process.exit(broken.length ? 1 : 0);
  }

  /* ---------- 2. 逐条确认 ---------- */
  console.log('\n' + C.bold('官网价和库里不一样：') + '\n');
  const toApply = [];
  for (const m of mismatch) {
    console.log(`  ${C.bold(m.planId)}  ${m.name}`);
    console.log(`    库里 ${m.expected}  →  官网 ${C.yellow(m.parsed)}`);
    console.log(C.dim(`    ${m.url}`));
    if (CHECK_ONLY) { console.log(''); continue; }
    let yes = AUTO_YES;
    if (!AUTO_YES) {
      const a = await ask('    改成官网价？(y/N) ');
      yes = a === 'y' || a === 'yes';
    }
    console.log(yes ? C.green('    → 改') : C.dim('    → 跳过'));
    console.log('');
    if (yes) toApply.push(m);
  }

  if (CHECK_ONLY) {
    console.log(C.dim('--check 模式：只看不改。去掉 --check 就会逐条问你。'));
    process.exit(0);
  }
  if (!toApply.length) {
    console.log('没有选中要改的，结束。');
    process.exit(0);
  }

  /* ---------- 3. 改数据 ---------- */
  console.log(C.bold('正在改数据…'));
  for (const m of toApply) {
    const r = run(process.execPath, ['scripts/set-price.js', m.planId, String(m.parsed)]);
    if (r.status !== 0) console.log(C.red(`  ${m.planId} 改失败`));
  }

  /* ---------- 4. 门禁 ---------- */
  console.log(C.bold('\n跑门禁（约 2–4 分钟）…\n'));
  const gate = run('npm', ['run', 'check'], { stdio: 'inherit' });
  if (gate.status !== 0) {
    console.log(C.red('\n门禁没过，先别发。看上面哪一步红了。'));
    process.exit(1);
  }
  console.log(C.green('\n门禁全过。'));

  /* ---------- 5. 提交推送 ---------- */
  if (NO_PUSH) {
    console.log(C.dim('\n--no-push：改动留在本地，自己看 diff。'));
    process.exit(0);
  }
  if (!AUTO_YES) {
    const a = await ask('\n提交并推送到线上？(y/N) ');
    if (a !== 'y' && a !== 'yes') { console.log(C.dim('已停在本地。')); process.exit(0); }
  }

  const names = toApply.map(m => `${m.planId} ${m.expected}→${m.parsed}`).join('，');
  const msg = `data: 按官网更新 ${toApply.length} 档价格（${today} 核验）\n\n${names}\n\nCo-Authored-By: Claude Code <noreply@anthropic.com>`;
  run('git', ['add', '-A']);
  const c = run('git', ['commit', '-m', msg]);
  if (c.status !== 0) { console.log(C.dim('没有可提交的改动（可能数据已经是最新的）。')); process.exit(0); }
  const p = run('git', ['push', 'origin', 'main'], { stdio: 'inherit' });
  console.log(p.status === 0 ? C.green('\n已推送。GitHub 会自动构建并部署，约 2 分钟。') : C.red('\n推送失败，看上面的报错。'));
})();
