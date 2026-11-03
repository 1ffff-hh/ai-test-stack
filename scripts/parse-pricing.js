#!/usr/bin/env node
/* =========================================================
   价格确定性解析
   ---------------------------------------------------------
   用法：
     node scripts/parse-pricing.js             # 抓官网、按规则抽价、和 plans.json 比对
     node scripts/parse-pricing.js --dump      # 额外打印每个规则的命中窗口，用来调锚点
     node scripts/parse-pricing.js --fixtures  # 把命中窗口存成 data/fixtures/*.json
     node scripts/parse-pricing.js --offline   # 不联网，只用 fixture 跑（等价于自测）

   为什么不用模型读价格：
     模型会把「2,000 积分」读成价格、把「From $100」读成 $100、把促销价当标准价。
     价格是本站的核心数据，宁可解析失败并报警，也不要一个看起来很合理的错数。

   规则怎么工作：
     锚点（anchor）定位到页面上那一行 → 从锚点起 window 个字符内跑 pattern →
     取第 1 个捕获组当数字。pick:last 取最后一个匹配（「首月 ¥34 / 标准价 ¥49」）。
     锚点找不到、正则不匹配、抽出来不是数字，都算失败，不做任何兜底猜测。
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { UA, fetchText, stripTags } = require('./lib/net');

const DATA = path.join(__dirname, '..', 'data');
const FIX = path.join(DATA, 'fixtures');
const readJSON = (f, fb) => {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); } catch (e) { return fb; }
};
const writeJSON = (f, o) => fs.writeFileSync(path.join(DATA, f), JSON.stringify(o, null, 1));
const today = () => new Date().toISOString().slice(0, 10);

const args = process.argv.slice(2);
const DUMP = args.includes('--dump');
const SAVE_FIXTURES = args.includes('--fixtures');
const OFFLINE = args.includes('--offline');

const cfg = readJSON('pricing-sources.json', { sources: [] });
const plans = readJSON('plans.json', []);

/* 有些站是 SPA，fetch 只拿到空壳（qoder.cn 的正文只有 12 个字符）。
   这类源标 render:true，用项目已有的 Playwright 渲染后再取 innerText。 */
let _browser = null;
async function renderText(url) {
  const browser = require('./browser');
  if (!_browser) _browser = await browser.launch();
  const page = await _browser.newPage({ userAgent: UA });
  try {
    /* 用 domcontentloaded 而不是 networkidle：不少定价页挂着长连接，
       networkidle 永远等不到，最后按超时算失败。 */
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3500);
    const t = await page.evaluate(() => (document.body ? document.body.innerText : ''));
    return String(t).replace(/\s+/g, ' ').trim();
  } finally {
    await page.close();
  }
}

/* 在窗口里抽一个数：锚点定位 → 正则 → 数字 */
function extract(text, rule) {
  const nth = rule.nth || 1;
  let from = 0;
  let idx = -1;
  for (let i = 0; i < nth; i++) {
    idx = text.indexOf(rule.anchor, from);
    if (idx < 0) return { ok: false, why: 'anchor-not-found' };
    from = idx + rule.anchor.length;
  }
  /* 默认从锚点本身开始取窗口。往前多取 40 字会把上一张卡的价格吃进来
     （「Plus $8 /month Get Plus Premium $30」里取到 $8 就是这么来的）。 */
  const before = rule.before == null ? 0 : rule.before;
  const window = rule.window || 200;
  const slice = text.slice(Math.max(0, idx - before), idx + window);
  const all = slice.match(new RegExp(rule.pattern, 'gi')) || [];
  if (!all.length) return { ok: false, why: 'pattern-not-matched', slice };
  /* 同一张卡上常有「首月优惠 ¥34」和标准价 ¥49」两个数。
     默认取第一个；写 pick:"last" 取最后一个（标准价一般排在促销价后面）。 */
  const chosen = rule.pick === 'last' ? all[all.length - 1] : all[0];
  const m = chosen.match(new RegExp(rule.pattern, 'i'));
  if (!m) return { ok: false, why: 'pattern-not-matched', slice };
  const raw = m[1] !== undefined ? m[1] : m[0];
  let val = parseFloat(String(raw).replace(/[,\s]/g, ''));
  if (!isFinite(val)) return { ok: false, why: 'not-a-number', raw, slice };
  if (rule.divide) val = val / rule.divide;
  if (rule.round !== false) val = Math.round(val * 100) / 100;
  return { ok: true, value: val, raw, slice };
}

const results = [];
const fixtureOut = {};

(async () => {
  for (const src of cfg.sources) {
    if (src.mode === 'manual') {
      results.push({ source: src.id, url: src.url, planId: '-', status: 'manual', why: src.note || '页面无静态价格' });
      continue;
    }
    const fx = OFFLINE ? readJSON(path.join('fixtures', src.id + '.json'), null) : null;
    if (OFFLINE && !fx) {
      results.push({ source: src.id, url: src.url, planId: '-', status: 'no-fixture', why: '缺少 fixture，先跑 --fixtures' });
      continue;
    }

    let text = '';
    if (!OFFLINE) {
      /* 抓取偶发超时（github / 国内站点都会），重试一次再判失败 */
      let lastErr = null;
      for (let attempt = 0; attempt < 2 && !text; attempt++) {
        try {
          text = src.render ? await renderText(src.url) : stripTags(await fetchText(src.url, 15000));
        } catch (e) {
          lastErr = e;
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      if (!text) {
        results.push({ source: src.id, url: src.url, planId: '-', status: 'fetch-fail', why: String((lastErr && lastErr.message) || lastErr || '').slice(0, 80) });
        continue;
      }
    }

    const wins = {};
    for (const [planId, rule] of Object.entries(src.plans || {})) {
      const plan = plans.find(p => p.id === planId);
      if (!plan) { results.push({ source: src.id, planId, status: 'no-plan', why: 'plans.json 里没有这个 id' }); continue; }
      const scope = OFFLINE ? (fx.windows || {})[planId] : text;
      if (OFFLINE && !scope) { results.push({ source: src.id, planId, status: 'no-fixture', why: 'fixture 里没有这条的窗口' }); continue; }
      const got = extract(scope, rule);
      if (!got.ok) {
        results.push({ source: src.id, url: src.url, planId, name: plan.name + ' ' + plan.tier, status: 'parse-fail', why: got.why, slice: got.slice ? got.slice.slice(0, 160) : '' });
        continue;
      }
      wins[planId] = got.slice;
      const expected = plan.priceLocal;
      const same = Math.abs(got.value - expected) < 0.01;
      results.push({
        source: src.id, url: src.url, planId, name: plan.name + ' ' + plan.tier,
        status: same ? 'ok' : 'mismatch',
        expected, parsed: got.value,
        slice: DUMP ? got.slice.slice(0, 160) : undefined
      });
    }
    if (!OFFLINE) fixtureOut[src.id] = { url: src.url, fetchedAt: today(), windows: wins };
  }

  if (_browser) await _browser.close();

  const ok = results.filter(r => r.status === 'ok').length;
  const mismatch = results.filter(r => r.status === 'mismatch').length;
  const fail = results.filter(r => ['parse-fail', 'fetch-fail', 'no-fixture', 'no-plan'].includes(r.status)).length;

  /* 指纹变了、但解析出来的价格一个没变 —— 多半是文案、日期、计数器变了。
     这类不该每周打扰人：直接把指纹更新到新值，记一笔 auto-ok 留在审计里。
     只对「该源所有已配置的档位都解析成功且与库内一致」的才这么办；
     少解析出一档就不动，宁可多报一次。 */
  let autoOk = 0;
  if (!OFFLINE) {
    const pendingFile = readJSON('_pending.json', { items: [] });
    const snap = readJSON('_price-snapshots.json', { pages: {} });
    for (const it of pendingFile.items || []) {
      if (it.status !== 'pending') continue;
      const src = cfg.sources.find(s => s.id === it.id);
      if (!src || src.mode === 'manual' || !src.plans || !Object.keys(src.plans).length) continue;
      const ids = Object.keys(src.plans);
      const rows = results.filter(r => r.source === it.id && ids.includes(r.planId));
      if (!rows.length || rows.length !== ids.length || rows.some(r => r.status !== 'ok')) continue;
      it.status = 'auto-ok';
      it.note = '解析出的价格与库内一致，判定为文案 / 结构变化';
      it.resolvedAt = today();
      snap.pages[it.id] = { name: it.name, url: it.url, hash: it.newHash, prices: it.newPrices, at: today() };
      autoOk++;
    }
    if (autoOk) {
      writeJSON('_pending.json', pendingFile);
      writeJSON('_price-snapshots.json', snap);
    }
  }

  const out = { updated: today(), checked: results.length, ok, mismatch, failed: fail, items: results };
  if (!OFFLINE) writeJSON('_price-check.json', out);
  if (SAVE_FIXTURES && !OFFLINE) {
    fs.mkdirSync(FIX, { recursive: true });
    for (const [id, fx] of Object.entries(fixtureOut)) {
      if (Object.keys(fx.windows).length) fs.writeFileSync(path.join(FIX, id + '.json'), JSON.stringify(fx));
    }
  }

  console.log(`价格解析 · ${today()}${OFFLINE ? '（offline）' : ''}`);
  console.log(`  ${results.length} 条规则：${ok} 命中一致 · ${mismatch} 与库内不符 · ${fail} 失败`);
  if (autoOk) console.log(`  指纹变了但价格没变，已自动销掉 ${autoOk} 条待办`);
  if (mismatch) {
    console.log('\n  与 plans.json 不符（先确认官网是不是真变了）：');
    results.filter(r => r.status === 'mismatch').forEach(r => console.log(`   · ${r.planId}  ${r.name}  库内 ${r.expected} → 官网 ${r.parsed}`));
  }
  if (fail) {
    console.log('\n  解析失败（规则要修，或页面改版）：');
    results.filter(r => ['parse-fail', 'fetch-fail', 'no-fixture', 'no-plan'].includes(r.status))
      .forEach(r => console.log(`   · ${r.source}${r.planId !== '-' ? '/' + r.planId : ''}  ${r.status}  ${r.why}`));
  }
  if (DUMP) {
    console.log('\n  命中窗口：');
    results.filter(r => r.slice).forEach(r => console.log(`   · ${r.planId}: …${r.slice}…`));
  }
  process.exit(mismatch || fail ? 1 : 0);
})();
