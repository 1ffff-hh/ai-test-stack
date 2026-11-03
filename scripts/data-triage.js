#!/usr/bin/env node
/* =========================================================
   价格变更待办 · 处置队列
   ---------------------------------------------------------
   用法：
     node scripts/data-triage.js                  # 列出待处置
     node scripts/data-triage.js --accept <id>    # 确认「页面变了，数据已按需更新」
     node scripts/data-triage.js --reject <id>    # 确认「页面变了，但与价格无关」
     node scripts/data-triage.js --accept-all     # 全部接受（仅用于首次铺基线）

   数据流：
     refresh.js 抓到页面变化 → 写 data/_pending.json，且**不更新**快照指纹
     → 人看一眼，accept / reject
     → 本脚本把新指纹写回 _price-snapshots.json，条目移出待办，记一笔 _data-audit.json

   为什么 accept 之后才更新指纹：不这么做，下一次抓取会把「未处置的变化」当成新基线，
   等于自动接受。价格是本站的核心数据，变化必须有人看一眼。
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data');
const readJSON = (f, fb) => {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); } catch (e) { return fb; }
};
const writeJSON = (f, o) => fs.writeFileSync(path.join(DATA, f), JSON.stringify(o, null, 1));
const today = () => new Date().toISOString().slice(0, 10);

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : null;
};

const pendingFile = readJSON('_pending.json', { items: [] });
const items = (pendingFile.items || []).filter(x => x.status === 'pending');

if (!items.length) {
  console.log('没有待处置的价格变更。');
  process.exit(0);
}

const snap = readJSON('_price-snapshots.json', { pages: {} });
const audit = readJSON('_data-audit.json', { entries: [] });

const resolve = (id, action) => {
  const it = items.find(x => x.id === id);
  if (!it) { console.error('待办里没有这个 id：' + id); return false; }
  snap.pages[id] = {
    name: it.name, url: it.url, hash: it.newHash,
    prices: it.newPrices, at: today()
  };
  it.status = action === 'accept' ? 'accepted' : 'rejected';
  it.resolvedAt = today();
  audit.entries.unshift({
    id: it.id, name: it.name, url: it.url, action,
    at: today(),
    added: it.added, removed: it.removed,
    firstDetectedAt: it.firstDetectedAt
  });
  console.log(`${action === 'accept' ? '已接受' : '已忽略'}：${it.name}（${it.id}）`);
  return true;
};

const acceptId = flag('--accept');
const rejectId = flag('--reject');

if (acceptId && acceptId !== true) {
  if (!resolve(acceptId, 'accept')) process.exit(1);
} else if (rejectId && rejectId !== true) {
  if (!resolve(rejectId, 'reject')) process.exit(1);
} else if (args.includes('--accept-all')) {
  items.forEach(it => resolve(it.id, 'accept'));
} else {
  console.log(`待处置 ${items.length} 条：\n`);
  for (const it of items) {
    console.log(`  ${it.id}  ${it.name}`);
    console.log(`    ${it.url}`);
    console.log(`    首次发现 ${it.firstDetectedAt} · 最近 ${it.detectedAt}`);
    if (it.added.length) console.log(`    新增价格：${it.added.join('  ')}`);
    if (it.removed.length) console.log(`    消失价格：${it.removed.join('  ')}`);
    if (!it.added.length && !it.removed.length) console.log('    价格数字没变，可能是文案/结构变化');
    console.log(`    处置：--accept ${it.id}  /  --reject ${it.id}\n`);
  }
  console.log('处置完记得改 data/plans.json 或 tools.json，并把对应条目的 verified 改成今天。');
  process.exit(0);
}

writeJSON('_price-snapshots.json', snap);
writeJSON('_pending.json', { updated: today(), items: (pendingFile.items || []) });
writeJSON('_data-audit.json', { updated: today(), entries: audit.entries.slice(0, 200) });
