#!/usr/bin/env node
/* =========================================================
   AI Test Stack · 数据自动更新
   ---------------------------------------------------------
   用法：
     node scripts/refresh.js              # 抓 RSS + 比价快照
     node scripts/refresh.js --dry        # 只打印，不落盘
     node scripts/refresh.js --offline    # 不联网，只做新鲜度报告
     node scripts/refresh.js --only=news  # 只跑新闻
   产出：
     data/news-auto.json          自动抓取的新闻（与人工条目分开）
     data/_price-snapshots.json   价格页文本指纹（只做"变了"的告警，不自动改价）
     data/_refresh-report.json    运行报告（页面会显示"最近一次更新"）
   设计原则：
     1) 自动抓取永远不覆盖人工核过的条目；
     2) 价格只报警不改数——自动解析价格会把"$20 起"读成"$20"；
     3) 每个源失败都记录，不让一个坏源拖垮整次运行。
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const OFFLINE = args.includes('--offline');
const ONLY = (args.find(a => a.startsWith('--only=')) || '').split('=')[1] || '';

const readJSON = (f, fb) => {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); } catch (e) { return fb; }
};
const writeJSON = (f, o) => fs.writeFileSync(path.join(DATA, f), JSON.stringify(o, null, 1));

const cfg = readJSON('feed-sources.json', { feeds: [], pricing: [], keywords: [] });
const manual = readJSON('news.json', { events: [] });
const prevAuto = readJSON('news-auto.json', { events: [] });
const prevSnap = readJSON('_price-snapshots.json', { pages: {} });

const { UA, fetchText, stripTags } = require('./lib/net');

function pick(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? stripTags(m[1]) : '';
}
function pickLink(block) {
  let m = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  if (m) return m[1];
  m = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
  return m ? stripTags(m[1]) : '';
}
function parseDate(s) {
  const t = Date.parse(s || '');
  if (!isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseFeed(xml, feed) {
  const items = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  blocks.slice(0, 40).forEach((b, i) => {
    const title = pick(b, 'title');
    const link = pickLink(b);
    const desc = pick(b, 'description') || pick(b, 'summary') || pick(b, 'content');
    const date = parseDate(pick(b, 'pubDate') || pick(b, 'published') || pick(b, 'updated'));
    if (!title || !link) return;
    items.push({
      id: 'auto-' + feed.id + '-' + crypto.createHash('md5').update(link + title).digest('hex').slice(0, 10),
      date, region: feed.region || 'global', kind: feed.kind || 'product',
      title, body: desc.slice(0, 260), impact: '', source: { name: feed.name, url: link },
      srcType: 'auto', auto: true, feed: feed.id, weight: 1, tags: ['自动抓取']
    });
  });
  return items;
}

const norm = s => stripTags(String(s || '')).replace(/&#?\w+;/g, '').toLowerCase().replace(/[\s\p{P}]/gu, '').slice(0, 60);
// 标题党的词不进自动列表：自动条目本来就没人复核，再混进标题党会直接毁掉可信度
const CLICKBAIT = ['紧急','叫停','炸','爆','重磅','刚刚','彻底','逆天','封神','史上','震惊','突发','疯','王炸','秒杀','吊打','官宣','大消息','速看','一文读懂'];
const KW = (cfg.keywords || []).map(k => k.toLowerCase());
const STRONG = ['大模型','llm','agent','智能体','gpt','claude','gemini','grok','muse','qwen','通义','deepseek','kimi','glm','智谱','豆包','minimax','copilot','cursor','trae','qoder','文心','codebuddy','playwright','cypress','测试','test','model context'];
function relevant(it) {
  if (!KW.length) return true;
  const title = it.title.toLowerCase();
  if (CLICKBAIT.some(w => it.title.includes(w))) return false;
  // 标题必须命中强关键词：正文里带一句"AI"不算相关
  if (!STRONG.some(k => title.includes(k))) return false;
  const hay = (it.title + ' ' + it.body).toLowerCase();
  return KW.some(k => hay.includes(k.toLowerCase()));
}

async function runNews(report) {
  const feeds = (cfg.feeds || []).filter(f => f.enabled !== false);
  // 旧自动条目也要重新过一遍过滤器：规则收紧后，历史里的标题党不能继续留着
  const keptSeen = new Set();
  const kept = (prevAuto.events || [])
    .map(it => Object.assign({}, it, { title: stripTags(it.title), body: stripTags(it.body || '') }))
    .filter(it => {
      const t = String(it.title || '');
      if (!t || /&#?\w+;/.test(t)) return false;
      if (CLICKBAIT.some(w => t.includes(w))) return false;
      if (!relevant(it)) return false;
      const k = norm(t);
      if (keptSeen.has(k)) return false;
      keptSeen.add(k);
      return true;
    });
  const seen = new Set([...(manual.events || []).map(e => norm(e.title)), ...kept.map(e => norm(e.title))]);
  const fresh = [];
  const t0 = Date.now();
  for (const f of feeds) {
    const st = { id: f.id, name: f.name, ok: false, n: 0, err: '' };
    if (OFFLINE) { st.err = 'offline'; report.feeds.push(st); continue; }
    if (Date.now() - t0 > 75000) { st.err = 'budget'; report.feeds.push(st); continue; }
    try {
      const xml = await fetchText(f.url);
      const items = parseFeed(xml, f).filter(relevant);
      let added = 0;
      items.slice(0, 8).forEach(it => {
        const k = norm(it.title);
        if (seen.has(k)) return;
        seen.add(k); fresh.push(it); added++;
      });
      st.ok = true; st.n = added;
    } catch (e) { st.err = String(e.message || e).slice(0, 120); }
    report.feeds.push(st);
  }
  const all = [...kept, ...fresh]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 60);
  if (!DRY) writeJSON('news-auto.json', { updated: new Date().toISOString().slice(0, 10), events: all });
  report.news = { feeds: feeds.length, fetched: fresh.length, total: all.length };
  return fresh;
}

async function runPricing(report) {
  const pages = cfg.pricing || [];
  const snap = { updated: new Date().toISOString().slice(0, 10), pages: Object.assign({}, prevSnap.pages) };
  const changes = [];
  const today = new Date().toISOString().slice(0, 10);
  /* 待办队列：检测到页面变了就记一条，等人工 data:triage 处置。
     变了但没处置之前，快照里的旧指纹保持不变——这样它每天都会继续报，
     不会被下一次抓取悄悄「接受」。 */
  const prevPending = readJSON('_pending.json', { items: [] });
  const pending = new Map((prevPending.items || []).filter(x => x.status === 'pending').map(x => [x.id, x]));
  for (const p of pages) {
    const st = { id: p.id, name: p.name, ok: false, changed: false, err: '' };
    if (OFFLINE) { st.err = 'offline'; report.pricing.push(st); continue; }
    try {
      const html = await fetchText(p.url);
      const text = stripTags(html).slice(0, 200000);
      const hash = crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
      const prices = (text.match(/[$¥]\s?\d+(?:\.\d{1,2})?/g) || []).slice(0, 24);
      const old = snap.pages[p.id];
      if (old && old.hash !== hash) {
        st.changed = true;
        changes.push({ id: p.id, name: p.name, url: p.url, old: old.hash, now: hash });
        const prevPrices = old.prices || [];
        const prevItem = pending.get(p.id);
        pending.set(p.id, {
          id: p.id,
          name: p.name,
          url: p.url,
          oldHash: old.hash,
          newHash: hash,
          oldPrices: prevPrices,
          newPrices: prices,
          added: prices.filter(x => !prevPrices.includes(x)).slice(0, 20),
          removed: prevPrices.filter(x => !prices.includes(x)).slice(0, 20),
          firstDetectedAt: prevItem ? prevItem.firstDetectedAt : today,
          detectedAt: today,
          status: 'pending'
        });
        // 不更新快照指纹，等 triage 处置
      } else {
        snap.pages[p.id] = { name: p.name, url: p.url, hash, prices, at: today };
      }
      st.ok = true;
    } catch (e) { st.err = String(e.message || e).slice(0, 120); }
    report.pricing.push(st);
  }
  if (!DRY) {
    writeJSON('_price-snapshots.json', snap);
    writeJSON('_pending.json', { updated: today, items: Array.from(pending.values()) });
  }
  report.priceChanges = changes;
  report.pendingCount = pending.size;
  return changes;
}

function freshness(report) {
  const files = [
    ['tools.json', '工具'], ['plans.json', '套餐'], ['promos.json', '优惠'], ['freebies.json', '免费额度'],
    ['news.json', 'AI 大事'], ['roles.json', '角色阶梯'], ['impact.json', '冲击数据']
  ];
  const today = new Date();
  report.freshness = files.map(([f, name]) => {
    let d = null;
    try {
      const j = readJSON(f, null);
      if (f === 'tools.json') d = j.map(x => x.verified).sort().pop();
      else if (f === 'plans.json') d = j.map(x => x.verified).sort().pop();
      else if (f === 'promos.json') {
        const all = [].concat(j.freeTier || [], j.firstBuy || []).map(x => x.verified).filter(Boolean).sort();
        d = all.length ? all[all.length - 1] : null;
      } else if (f === 'freebies.json') {
        /* 只算「公开页能核」的条目。要登录或页面压根不写额度的标了 verifiable:false，
           把它们算进来会让新鲜度永远显示过期，而实际上没人能核。 */
        const all = (j.items || []).filter(x => x.verifiable !== false).map(x => x.verified).filter(Boolean).sort();
        d = all.length ? all[all.length - 1] : (j.updated || null);
      } else d = j.updated || j.lastVerified || null;
    } catch (e) {}
    const days = d ? Math.max(0, Math.round((today - new Date(d)) / 86400000)) : null;
    return { file: f, name, date: d, days, stale: days == null ? true : days > 30 };
  });
}

(async () => {
  const started = new Date();
  const report = { at: started.toISOString(), dry: DRY, offline: OFFLINE, feeds: [], pricing: [], news: null, priceChanges: [], freshness: [] };
  let fresh = [];
  if (ONLY !== 'pricing') fresh = await runNews(report);
  if (ONLY !== 'news') await runPricing(report);
  freshness(report);
  report.durationMs = Date.now() - started.getTime();
  if (!DRY) writeJSON('_refresh-report.json', report);

  console.log(`\n刷新${DRY ? '（dry）' : ''}${OFFLINE ? '（offline）' : ''} · ${report.durationMs}ms`);
  console.log(`  新闻：${report.news ? report.news.fetched + ' 条新增 / 共 ' + report.news.total : '跳过'}`);
  console.log(`  价格页：${report.pricing.filter(p => p.ok).length}/${report.pricing.length} 抓取成功，${report.priceChanges.length} 个页面有变化`);
  if (report.pendingCount) console.log(`  待处置：${report.pendingCount} 条 → node scripts/data-triage.js`);
  const bad = report.feeds.filter(f => !f.ok).concat(report.pricing.filter(p => !p.ok));
  if (bad.length) console.log('  失败源：' + bad.length + '（已在报告中记录，不阻塞）');
  console.log('  新鲜度：' + report.freshness.map(f => `${f.name} ${f.days == null ? '—' : f.days + 'd'}${f.stale ? '⚠' : ''}`).join(' · '));
  if (fresh.length) {
    console.log('\n  新增条目：');
    fresh.slice(0, 6).forEach(e => console.log(`   · [${e.date}] ${e.title}`));
    if (fresh.length > 6) console.log(`   … 其余 ${fresh.length - 6} 条`);
  }
  if (!DRY) console.log('\n  已写入 data/news-auto.json / _price-snapshots.json / _refresh-report.json');
})();
