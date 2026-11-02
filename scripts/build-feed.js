#!/usr/bin/env node
/* 生成 Atom 订阅源 → _site/feed.xml

   为什么要有：这个站的新闻和价格每周都在变，但访客没有任何理由回来。
   RSS 是唯一一个"不收集用户信息、不要求注册、不要后端"的回访机制——
   和这个站「静态、零依赖、不追踪」的定位是同一件事。

   条目来自两处：data/news.json（外部大事）与 data/changelog.json（本站自己改了什么）。
   后者容易被忽略，但对回头客更有用：他知道哪条数据被修正过。

   用法： node scripts/build-feed.js    （输出 JSON 摘要，由 build-site.js 调用） */
'use strict';
const fs = require('fs');
const path = require('path');
const { detect, ROOT } = require('./site-base');

const OUT = path.join(ROOT, '_site');
const { url } = detect();

const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'));
const meta = read('meta.json');
const news = read('news.json');
const log = read('changelog.json');
const auto = (() => { try { return read('news-auto.json'); } catch (e) { return { events: [] }; } })();

// XML 文本节点与属性都要转义；& 必须第一个换，否则会把后面生成的实体再转一遍
const x = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

// 站点按北京时间维护，日期只有天粒度，补成 RFC3339
const at = d => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d + 'T09:00:00+08:00' : new Date(d).toISOString());
const today = meta.lastBuilt || meta.lastVerified;

const entries = [];

(news.events || []).forEach(e => entries.push({
  id: 'news-' + e.id,
  date: e.date,
  view: 'news',
  title: e.title,
  body: [e.body, e.impact ? '对测试的影响：' + e.impact : ''].filter(Boolean).join('\n\n'),
  url: e.source && e.source.url
}));

(log || []).forEach((e, i) => entries.push({
  id: 'log-' + e.date + '-' + i,
  date: e.date,
  view: 'changelog',
  title: '本站更新：' + e.title,
  body: [e.body, (e.items || []).join('\n')].filter(Boolean).join('\n\n')
}));

/* 自动抓取的条目默认不在页面上显示（未经过人眼），所以也不进订阅源——
   订阅源是"我确认过的东西"，掺进未审核内容会让它变成噪声。 */
void auto;

entries.sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.id.localeCompare(b.id));
const keep = entries.slice(0, 40);
const newest = keep[0] || { date: today };

const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${x(meta.siteName)} · 更新与核验记录</title>
  <subtitle>${x('价格核验、免费额度变动、AI 工具大事，以及本站自己改了什么。数据核验日：' + meta.lastVerified)}</subtitle>
  <link href="${x(url)}"/>
  <link rel="self" type="application/atom+xml" href="${x(url + 'feed.xml')}"/>
  <id>${x(url)}</id>
  <updated>${at(newest.date)}</updated>
  <author><name>${x(meta.siteName)}</name></author>
  <rights>MIT</rights>
  <generator uri="${x(url)}" version="${x(meta.version)}">AI Test Stack build.js</generator>
${keep.map(e => `  <entry>
    <title>${x(e.title)}</title>
    <link rel="alternate" type="text/html" href="${x(url + '#' + e.view)}"/>
    <id>${x(url + '#' + e.id)}</id>
    <updated>${at(e.date)}</updated>
    <published>${at(e.date)}</published>
    <summary type="text">${x(e.body)}</summary>
  </entry>`).join('\n')}
</feed>
`;

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'feed.xml'), xml, 'utf8');

console.log(JSON.stringify({
  out: 'feed.xml',
  entries: keep.length,
  latest: newest.date,
  bytes: Buffer.byteLength(xml, 'utf8')
}));
