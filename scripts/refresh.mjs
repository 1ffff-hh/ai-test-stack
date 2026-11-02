#!/usr/bin/env node
/* =========================================================
   refresh.mjs — 数据新鲜度 / 链接健康 / 价格探测
   ---------------------------------------------------------
   用法：
     node scripts/refresh.mjs              # 全量检查，产出报告，不改数据
     node scripts/refresh.mjs --apply      # 检出确定的价格变化时写回 data/plans.json
     node scripts/refresh.mjs --browser    # 用 Playwright 渲染后再抓（覆盖 SPA 定价页）
     node scripts/refresh.mjs --json       # 只输出机器可读摘要（给自动化用）
     node scripts/refresh.mjs --links      # 只做链接健康检查（最快）

   三层检查，可靠性依次下降，所以分开报告：
     L1 新鲜度   —— 纯本地计算，100% 可靠。数据多久没核验过。
     L2 链接健康 —— HTTP 状态 + 页面标题。可靠。链接挂了/被重定向到首页，说明该人工看了。
     L3 价格探测 —— 尽力而为。国内定价页多是 SPA 或把价格放另一个页面，抓不到很正常。

   为什么默认不改数据：
     价格抓取天然不可靠。自动写回一个抓错的价格，比不更新更糟。
     所以默认只报告，--apply 才写回，而且只写「确定」的变化。

   什么算「确定」的价格：
     1. 页面里必须出现货币标记（¥ / ￥ / 元），否则视为「这页没价格」。
     2. 数字必须紧贴货币标记，例如「Lite ¥118」。单独一个数字不算。
     3. 必须离档位名（Lite/Plus/Go）120 字符以内。
     4. 抓不到就如实说抓不到，绝不猜。
   ========================================================= */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const JSONOUT = args.includes('--json');
const USE_BROWSER = args.includes('--browser');
const LINKS_ONLY = args.includes('--links');

const readJSON = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8').replace(/^\uFEFF/, ''));
const writeJSON = (f, o) => fs.writeFileSync(path.join(DATA, f), JSON.stringify(o, null, 2) + '\n', 'utf8');
const today = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

const meta = readJSON('meta.json');
const tools = readJSON('tools.json');
const plans = readJSON('plans.json');

const staleAfter = meta.staleAfterDays || 30;
const now = today();
const staleTools = tools.filter(t => daysBetween(t.verified || '2000-01-01', now) > staleAfter);
const stalePlans = plans.filter(p => daysBetween(p.verified || '2000-01-01', now) > staleAfter);

/* ============ L2 链接健康 ============ */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

async function headCheckOnce(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal, redirect: 'follow',
      headers: { 'user-agent': UA, 'accept-language': 'zh-CN,zh;q=0.9' }
    });
    const html = await res.text();
    const title = (html.match(/<title[^>]*>([\s\S]{0,120}?)<\/title>/i) || [, ''])[1].replace(/\s+/g, ' ').trim();
    return { ok: res.ok, status: res.status, finalUrl: res.url, title };
  } catch (e) {
    return { ok: false, status: 0, reason: e.name === 'AbortError' ? '超时 20s' : e.message };
  } finally {
    clearTimeout(timer);
  }
}

/* 网络抖动会让单次探测误报「打不开」。重试两次再下结论，
   避免把偶发失败写进「人工复核清单」浪费人的时间。 */
async function headCheck(url) {
  let r = await headCheckOnce(url);
  for (let i = 0; i < 2 && !r.ok; i++) {
    await new Promise(res => setTimeout(res, 1200));
    r = await headCheckOnce(url);
  }
  return r;
}

/* 只把「深度链接被重定向到站点根/首页」算作需要关注。
   域名迁移、加 www、去掉尾部斜杠这些是正常的，不报。 */
function isDegradedRedirect(orig, finalUrl) {
  if (!finalUrl) return false;
  try {
    const a = new URL(orig), b = new URL(finalUrl);
    const depth = p => p.split('/').filter(Boolean).length;
    const aDepth = depth(a.pathname);
    const bDepth = depth(b.pathname);
    // 原来是个深层页面，现在落到根路径 → 大概率是内容被下线/迁移
    return aDepth >= 2 && bDepth === 0;
  } catch {
    return false;
  }
}

const linkTargets = [
  ...plans.filter(p => p.link).map(p => ({ kind: 'plan', id: p.id, name: `${p.name} ${p.tier}`, url: p.link })),
  ...tools.filter(t => t.link).map(t => ({ kind: 'tool', id: t.id, name: t.name, url: t.link }))
];

const links = [];
for (const t of linkTargets) {
  const r = await headCheck(t.url);
  const moved = r.ok && isDegradedRedirect(t.url, r.finalUrl);
  links.push({ ...t, ...r, redirected: r.finalUrl && r.finalUrl !== t.url, degraded: moved });
}

const brokenLinks = links.filter(l => !l.ok);
const degradedLinks = links.filter(l => l.degraded);

/* ============ L3 价格探测 ============ */
const P = id => plans.find(p => p.id === id);
const TARGETS = [
  { id: 'glm', tier: 'Lite', url: 'https://docs.bigmodel.cn/cn/coding-plan/overview', expect: P('glm')?.price },
  { id: 'volc', tier: 'Lite', url: 'https://www.volcengine.com/docs/82379/1928261', expect: P('volc')?.price },
  { id: 'kimip', tier: 'Plus', url: 'https://platform.moonshot.cn/docs/pricing', expect: P('kimip')?.price },
  { id: 'minimax', tier: 'Go', url: 'https://platform.minimaxi.com/subscribe/coding-plan', expect: P('minimax')?.price },
  { id: 'mimo', tier: 'Lite', url: 'https://mimo.mi.com/', expect: P('mimo')?.price }
];

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&yen;/gi, '¥')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

function findPrices(text) {
  const out = [];
  for (const m of text.matchAll(/[¥￥]\s?(\d{1,5})(?:\.\d+)?/g)) out.push({ value: Number(m[1]), at: m.index });
  for (const m of text.matchAll(/(\d{1,5})(?:\.\d+)?\s*元/g)) out.push({ value: Number(m[1]), at: m.index });
  return out.filter(p => p.value >= 9 && p.value <= 9999);
}

function analyze(text, tier) {
  const prices = findPrices(text);
  if (!prices.length) return { found: false, why: '页面没有货币标记（可能不是定价页）' };
  const positions = [...text.matchAll(new RegExp(tier, 'gi'))].map(m => m.index);
  if (!positions.length) return { found: false, why: `页面没有「${tier}」字样` };
  let best = null;
  for (const pos of positions) {
    for (const pr of prices) {
      const d = Math.abs(pr.at - pos);
      if (d <= 120 && (!best || d < best.d)) best = { ...pr, d };
    }
  }
  if (!best) return { found: false, why: `「${tier}」附近 120 字内没有价格` };
  return { found: true, value: best.value, distance: best.d };
}

async function fetchText(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': UA, 'accept-language': 'zh-CN,zh;q=0.9' } });
    if (!res.ok) return { ok: false, reason: 'HTTP ' + res.status };
    return { ok: true, text: await res.text() };
  } catch (e) {
    return { ok: false, reason: e.name === 'AbortError' ? '超时 15s' : e.message };
  } finally {
    clearTimeout(timer);
  }
}

let browser = null;
async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* 找全局 */ }
  const { createRequire } = await import('node:module');
  const { execSync } = await import('node:child_process');
  try {
    const root = execSync('npm root -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (root) return createRequire(path.join(root, 'playwright') + '/')('playwright');
  } catch { /* ignore */ }
  throw new Error('找不到 playwright。装一下：npm i -g playwright，或去掉 --browser 只用 fetch 模式。');
}

async function browserText(url) {
  if (!browser) {
    const { chromium } = await loadPlaywright();
    browser = await chromium.launch({ channel: 'chrome' });
  }
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
    return { ok: true, text: await page.innerText('body') };
  } catch (e) {
    return { ok: false, reason: e.message.split('\n')[0] };
  } finally {
    await page.close();
  }
}

async function probe(t) {
  const base = { id: t.id, tier: t.tier, url: t.url, expect: t.expect };

  if (!LINKS_ONLY) {
    const got = await fetchText(t.url);
    if (got.ok) {
      const a = analyze(htmlToText(got.text), t.tier);
      if (a.found) return { ...base, mode: 'fetch', ok: true, found: a.value, changed: a.value !== t.expect, delta: a.value - t.expect };
      if (!USE_BROWSER) return { ...base, mode: 'fetch', ok: false, needsBrowser: true, reason: a.why };
    } else if (!USE_BROWSER) {
      return { ...base, mode: 'fetch', ok: false, reason: got.reason };
    }
  }

  if (USE_BROWSER && !LINKS_ONLY) {
    const b = await browserText(t.url);
    if (!b.ok) return { ...base, mode: 'browser', ok: false, reason: b.reason };
    const a = analyze(b.text, t.tier);
    if (a.found) return { ...base, mode: 'browser', ok: true, found: a.value, changed: a.value !== t.expect, delta: a.value - t.expect };
    return { ...base, mode: 'browser', ok: false, reason: a.why };
  }

  return { ...base, mode: 'fetch', ok: false, reason: '跳过（--links 模式）' };
}

const probes = [];
if (!LINKS_ONLY) for (const t of TARGETS) probes.push(await probe(t));
if (browser) await browser.close();

const changed = probes.filter(p => p.ok && p.changed);

/* ============ 汇总 ============ */
const report = {
  generatedAt: new Date().toISOString(),
  today: now,
  mode: LINKS_ONLY ? 'links' : USE_BROWSER ? 'browser' : 'fetch',
  staleAfterDays: staleAfter,
  freshness: {
    tools: tools.map(t => ({ id: t.id, name: t.name, verified: t.verified, ageDays: daysBetween(t.verified, now) })),
    plans: plans.map(p => ({ id: p.id, name: p.name, tier: p.tier, verified: p.verified, ageDays: daysBetween(p.verified, now) })),
    staleTools: staleTools.map(t => t.name),
    stalePlans: stalePlans.map(p => `${p.name} ${p.tier}`)
  },
  links,
  probes,
  summary: {
    linksChecked: links.length,
    linksBroken: brokenLinks.length,
    linksDegraded: degradedLinks.length,
    pricesProbed: probes.length,
    pricesOk: probes.filter(p => p.ok).length,
    pricesChanged: changed.length,
    staleTools: staleTools.length,
    stalePlans: stalePlans.length
  }
};

fs.writeFileSync(path.join(DATA, '_refresh-report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');

if (APPLY && changed.length) {
  const map = new Map(plans.map(p => [p.id, p]));
  let applied = 0;
  for (const c of changed) {
    const p = map.get(c.id);
    if (!p) continue;
    p.history = p.history || [];
    p.history.push({ date: now, price: c.found, note: `自动检测：¥${c.expect} → ¥${c.found}` });
    p.price = c.found;
    p.verified = now;
    applied++;
  }
  writeJSON('plans.json', plans);
  report.applied = applied;
  fs.writeFileSync(path.join(DATA, '_refresh-report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
}

if (JSONOUT) { console.log(JSON.stringify(report.summary)); process.exit(0); }

const line = '─'.repeat(66);
console.log('\n' + line);
console.log('  AI Test Stack · 数据检查   ' + now + '   模式=' + report.mode);
console.log(line);

console.log('\n[L1 新鲜度]  阈值 ' + staleAfter + ' 天');
console.log('  工具 ' + tools.length + ' 条，过期 ' + staleTools.length + (staleTools.length ? ' → ' + staleTools.map(t => t.name).join('、') : '  ✓'));
console.log('  套餐 ' + plans.length + ' 条，过期 ' + stalePlans.length + (stalePlans.length ? ' → ' + stalePlans.map(p => p.name + ' ' + p.tier).join('、') : '  ✓'));

console.log('\n[L2 链接健康]  共 ' + links.length + ' 条');
if (brokenLinks.length) {
  brokenLinks.forEach(l => console.log('  ✗ 打不开  ' + l.kind + '/' + l.id.padEnd(10) + (l.reason || ('HTTP ' + l.status))));
} else {
  console.log('  ✓ 全部可访问');
}
if (degradedLinks.length) {
  degradedLinks.forEach(l => console.log('  ↪ 降级    ' + l.kind + '/' + l.id.padEnd(10) + '→ ' + l.finalUrl.slice(0, 70) + '  （原链接是深层页面，现在落到首页）'));
}

if (!LINKS_ONLY) {
  console.log('\n[L3 价格探测]  共 ' + probes.length + ' 条');
  probes.forEach(p => {
    if (!p.ok) {
      console.log('  ✗ 没抓到 ' + p.id.padEnd(8) + (p.reason || '') + (p.needsBrowser ? '  ← 加 --browser' : ''));
    } else if (p.changed) {
      console.log('  ⚠ 变化   ' + p.id.padEnd(8) + `期望 ¥${p.expect} → 实际 ¥${p.found}（${p.delta > 0 ? '+' : ''}${p.delta}）`);
    } else {
      console.log('  ✓ 一致   ' + p.id.padEnd(8) + `¥${p.found}`);
    }
  });

  if (changed.length) {
    console.log('\n[需要人工确认]');
    changed.forEach(c => console.log('  · ' + c.id + '：¥' + c.expect + ' → ¥' + c.found));
    console.log(APPLY ? '  已写回 data/plans.json' : '  未写回。确认无误后： node scripts/refresh.mjs --apply');
  }
}

/* ============ 人工复核清单（这段是给自动化任务直接念给用户听的） ============ */
const todo = [];
if (staleTools.length) todo.push(`工具数据过期：${staleTools.map(t => t.name).join('、')}`);
if (stalePlans.length) todo.push(`套餐数据过期：${stalePlans.map(p => p.name + ' ' + p.tier).join('、')}`);
if (brokenLinks.length) todo.push(`链接打不开：${brokenLinks.map(l => l.id).join('、')}`);
if (degradedLinks.length) todo.push(`链接降级到首页：${degradedLinks.map(l => l.id).join('、')}`);
changed.forEach(c => todo.push(`${c.id} 价格疑似变化：¥${c.expect} → ¥${c.found}`));

if (todo.length) {
  console.log('\n[人工复核清单]');
  todo.forEach((t, i) => console.log('  ' + (i + 1) + '. ' + t));
} else {
  console.log('\n  ✓ 没有需要人工复核的项。');
}

console.log('\n  报告 → data/_refresh-report.json');
console.log('  改完数据后 → node build.js\n');
