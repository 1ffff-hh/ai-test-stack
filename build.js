#!/usr/bin/env node
/* =========================================================
   AI Test Stack · build.js
   把 data/*.json + src/* 内联成单文件 index.html
   用法： node build.js
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'index.html');

function readJSON(file) {
  const p = path.join(DATA, file);
  if (!fs.existsSync(p)) throw new Error('缺少数据文件: ' + p);
  const raw = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error('JSON 解析失败 ' + file + ' → ' + e.message);
  }
}

function readJSONSafe(file, fallback) {
  try { return readJSON(file); } catch (e) { return fallback; }
}

function readText(file) {
  const p = path.join(SRC, file);
  if (!fs.existsSync(p)) throw new Error('缺少源文件: ' + p);
  return fs.readFileSync(p, 'utf8');
}

/* ---------- 1. 组装数据 ---------- */
const data = {
  meta: readJSON('meta.json'),
  tools: readJSON('tools.json'),
  plans: readJSON('plans.json'),
  bundles: readJSON('bundles.json'),
  aitest: readJSON('aitest.json'),
  events: readJSON('events.json'),
  persona: readJSON('persona.json'),
  opinion: readJSON('opinion.json'),
  promos: readJSON('promos.json'),
  capabilities: readJSON('capabilities.json'),
  criteria: readJSON('criteria.json'),
  roadmap: readJSON('roadmap.json'),
  changelog: readJSON('changelog.json'),
  sources: readJSON('sources.json'),
  modules: readJSON('modules.json'),
  planpack: readJSON('planpack.json'),
  news: readJSON('news.json'),
  newsAuto: readJSONSafe('news-auto.json', { updated: null, events: [] }),
  freebies: readJSON('freebies.json'),
  roles: readJSON('roles.json'),
  impact: readJSON('impact.json'),
  evalset: readJSON('evalset.json'),
  refreshReport: readJSONSafe('_refresh-report.json', null),
  feeds: readJSONSafe('feed-sources.json', { feeds: [], pricing: [] })
};

/* ---------- 2. 数据校验（构建期就把错拦下来） ---------- */
const errors = [];
const warns = [];

/* 日期字段是所有「新鲜度」判断的根：格式错了，页面上的「几天前核验」会算成 NaN。
   lastBuilt 用于导出文件的生成时间（见下方 BUILT_AT），不能早于 lastVerified。 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
['lastVerified', 'lastBuilt'].forEach(k => {
  if (!DATE_RE.test(data.meta[k] || '')) errors.push(`meta.json 的 ${k} 必须是 YYYY-MM-DD，当前是 ${JSON.stringify(data.meta[k])}`);
});
if (DATE_RE.test(data.meta.lastVerified) && DATE_RE.test(data.meta.lastBuilt)
    && data.meta.lastBuilt < data.meta.lastVerified) {
  errors.push(`meta.json 的 lastBuilt (${data.meta.lastBuilt}) 早于 lastVerified (${data.meta.lastVerified})：生成日期不可能早于核验日期`);
}

const toolIds = new Set(data.tools.map(t => t.id));
const capIds = new Set();
data.capabilities.groups.forEach(g => g.items.forEach(it => capIds.add(it.id)));
const critIds = new Set(data.criteria.criteria.map(c => c.id));
const planCritIds = new Set(data.criteria.planCriteria.map(c => c.id));

if (toolIds.size !== data.tools.length) errors.push('tools.json 存在重复 id');
if (data.tools.length === 0) errors.push('tools.json 为空');

data.tools.forEach(t => {
  if (!t.id || !t.name) errors.push('工具缺少 id/name: ' + JSON.stringify(t).slice(0, 60));
  critIds.forEach(c => {
    if (typeof t.score?.[c] !== 'number') errors.push(`工具 ${t.id} 缺少评分 ${c}`);
  });
  capIds.forEach(c => {
    if (typeof t.capabilities?.[c] !== 'number') warns.push(`工具 ${t.id} 缺少能力分 ${c}`);
  });
  Object.keys(t.capabilities || {}).forEach(c => {
    if (!capIds.has(c)) errors.push(`工具 ${t.id} 引用了不存在的能力项 ${c}`);
  });
  ['monthlyCost', 'scriptable', 'cnDirect'].forEach(k => {
    if (t[k] === undefined) errors.push(`工具 ${t.id} 缺少字段 ${k}`);
  });
  if (t.kind && ['shell', 'qa'].indexOf(t.kind) < 0) errors.push(`工具 ${t.id} 的 kind 非法: ${t.kind}`);
  if (t.region && ['cn', 'global'].indexOf(t.region) < 0) errors.push(`工具 ${t.id} 的 region 非法: ${t.region}`);
});

data.plans.forEach(p => {
  if (!p.id || !p.name) errors.push('套餐缺少 id/name');
  planCritIds.forEach(c => {
    if (typeof p.s?.[c] !== 'number') errors.push(`套餐 ${p.id} 缺少评分 ${c}`);
  });
});

Object.entries(data.criteria.profiles).forEach(([k, v]) => {
  Object.keys(v.w).forEach(c => {
    if (!critIds.has(c)) errors.push(`画像 ${k} 引用了不存在的维度 ${c}`);
  });
});
Object.entries(data.criteria.planProfiles).forEach(([k, v]) => {
  Object.keys(v.w).forEach(c => {
    if (!planCritIds.has(c)) errors.push(`套餐画像 ${k} 引用了不存在的维度 ${c}`);
  });
});

data.roadmap.phases.forEach(p => {
  (p.tools || []).forEach(id => {
    if (!toolIds.has(id) && !data.plans.some(x => x.id === id)) {
      warns.push(`路线 ${p.id} 引用了未知 id: ${id}`);
    }
  });
});

/* ---------- 套餐形态校验 ---------- */
const FORM_IDS = new Set(['coding', 'token', 'agent', 'member', 'paygo']);
const formCount = {};
data.plans.forEach(p => {
  if (!p.form) errors.push(`套餐 ${p.id} 缺少 form 字段（订阅形态）`);
  else if (!FORM_IDS.has(p.form)) errors.push(`套餐 ${p.id} 的 form 值无效: ${p.form}`);
  else formCount[p.form] = (formCount[p.form] || 0) + 1;
  ['quotaUnit', 'window', 'overage'].forEach(k => {
    if (!p[k]) warns.push(`套餐 ${p.id} 缺少 ${k}`);
  });
  if (p.region && ['cn', 'global'].indexOf(p.region) < 0) errors.push(`套餐 ${p.id} 的 region 非法: ${p.region}`);
  if (p.currency && ['CNY', 'USD'].indexOf(p.currency) < 0) errors.push(`套餐 ${p.id} 的 currency 非法: ${p.currency}`);
  if (p.currency === 'USD' && typeof p.priceLocal !== 'number') errors.push(`美元套餐 ${p.id} 缺少 priceLocal`);
  if (typeof p.price !== 'number') errors.push(`套餐 ${p.id} 的 price 必须是人民币等值数字`);
});

/* ---------- 执行包校验：每周至少一个动作，验收标准不能空 ---------- */
const PP = data.planpack;
if (!PP || !Array.isArray(PP.tasks) || !PP.tasks.length) errors.push('planpack.json 缺少 tasks');
else {
  const seen = new Set();
  const wk = new Set();
  PP.tasks.forEach(t => {
    if (!t.id || seen.has(t.id)) errors.push('执行包动作 id 缺失或重复: ' + t.id);
    seen.add(t.id);
    wk.add(t.w);
    ['t', 'd', 'acc'].forEach(k => { if (!t[k]) errors.push(`执行包动作 ${t.id} 缺少 ${k}`); });
    if (typeof t.min !== 'number') errors.push(`执行包动作 ${t.id} 缺少耗时 min`);
  });
  [1, 2, 3, 4].forEach(n => { if (!wk.has(n)) errors.push('执行包缺少第 ' + n + ' 周的动作'); });
  PP.tasks.forEach(t => { if (!PP.meta.weeks.some(w => w.n === t.w)) errors.push(`动作 ${t.id} 的周次 ${t.w} 不在 meta.weeks 里`); });
}

/* ---------- 组合方案校验 ---------- */
const bundleIds = new Set();
const planIds = new Set(data.plans.map(p => p.id));
data.bundles.forEach(b => {
  if (!b.id || !b.name) errors.push('组合方案缺少 id/name');
  if (bundleIds.has(b.id)) errors.push('组合方案 id 重复: ' + b.id);
  bundleIds.add(b.id);
  if (!toolIds.has(b.tool)) errors.push(`组合方案 ${b.id} 引用了不存在的工具 ${b.tool}`);
  // 订阅一体化产品没有独立套餐，允许 plan 为空，但 costBasis 必须写明订阅口径
  if (b.plan == null) {
    if (!/订阅/.test(String(b.costBasis || ''))) errors.push(`组合方案 ${b.id} 无套餐（一体化订阅产品），costBasis 必须写明订阅口径`);
  } else if (!planIds.has(b.plan)) {
    errors.push(`组合方案 ${b.id} 引用了不存在的套餐 ${b.plan}`);
  }
  if (typeof b.monthlyCost !== 'number') errors.push(`组合方案 ${b.id} 缺少 monthlyCost`);
  ['title', 'summary', 'fit', 'watch'].forEach(k => {
    if (!b[k]) errors.push(`组合方案 ${b.id} 缺少 ${k}`);
  });
  ['why', 'tags'].forEach(k => {
    if (!Array.isArray(b[k]) || !b[k].length) errors.push(`组合方案 ${b.id} 的 ${k} 必须是非空数组`);
  });
  if (!b.s || typeof b.s !== 'object') errors.push(`组合方案 ${b.id} 缺少评分 s`);
});

/* ---------- 模块配置校验（信息架构：功能地图把 16 个功能页组织成 5–6 个模块） ----------
   缺了某个功能页、一个功能页归进两个模块、引用了不存在的组合——都会在构建期拦下来，
   不等上线后用户点进空模块才发现。 */
const FEATURE_VIEW_IDS = ['overview', 'matrix', 'tools', 'capabilities', 'plans', 'promos', 'free', 'bundles', 'aitest', 'events', 'news', 'roles', 'impact', 'versus', 'persona', 'opinion', 'roadmap', 'stack', 'plan', 'changelog', 'sources', 'report', 'evalset', 'health'];
const moduleList = data.modules && data.modules.modules;
if (!Array.isArray(moduleList) || moduleList.length < 5 || moduleList.length > 9) {
  errors.push(`modules.json 应有 5–9 个模块，现在是 ${moduleList ? moduleList.length : '缺失'}`);
} else {
  const modIds = new Set();
  const seenViews = [];
  moduleList.forEach(m => {
    if (!m.id || !m.name) errors.push('模块缺少 id/name: ' + JSON.stringify(m).slice(0, 60));
    if (modIds.has(m.id)) errors.push(`模块 id 重复: ${m.id}`);
    if (m.id) modIds.add(m.id);
    if (!m.icon || !m.tagline || !m.desc) errors.push(`模块 ${m.id || '?'} 缺少 icon/tagline/desc`);
    if (!Array.isArray(m.features) || m.features.length === 0) errors.push(`模块 ${m.id || '?'} 没有任何功能页`);
    (m.features || []).forEach(f => {
      if (!FEATURE_VIEW_IDS.includes(f.v)) errors.push(`模块 ${m.id} 引用了未知功能页 ${f.v}`);
      if (!f.name || !f.line) errors.push(`模块 ${m.id} 的功能 ${f.v} 缺少 name/line`);
      seenViews.push(f.v);
    });
    (m.bundles || []).forEach(bid => {
      if (!bundleIds.has(bid)) errors.push(`模块 ${m.id} 引用了不存在的组合 ${bid}`);
    });
  });
  // next/path 里会引用别的模块 id，必须等所有模块注册完再校验（两遍扫描）
  const goOk = (g) => typeof g === 'string' && g[0] === '#' && (
    g === '#map' || g === '#home' || g === '#all' ||
    FEATURE_VIEW_IDS.includes(g.slice(1)) ||
    (g.indexOf('#mod-') === 0 && modIds.has(g.slice(5))));
  moduleList.forEach(m => {
    (m.path || []).forEach((s, i) => {
      if (!s.n) errors.push(`模块 ${m.id} 的 path[${i}] 缺少文案 n`);
      if (s.go && !goOk(s.go)) errors.push(`模块 ${m.id} 的 path[${i}].go 非法: ${s.go}`);
    });
    if (m.next) {
      if (!m.next.n) errors.push(`模块 ${m.id} 的 next 缺少文案 n`);
      if (!goOk(m.next.go)) errors.push(`模块 ${m.id} 的 next.go 非法: ${m.next.go}`);
    }
  });
  FEATURE_VIEW_IDS.forEach(v => {
    const n = seenViews.filter(x => x === v).length;
    if (n === 0) errors.push(`功能页 ${v} 没有归入任何模块（功能地图会出现漏页）`);
    if (n > 1) errors.push(`功能页 ${v} 被归入了 ${n} 个模块（只能归一个）`);
  });
}

/* ---------- AI 测试专项校验 ---------- */
const MATURITY = new Set(['stable', 'beta', 'experimental']);
const atIds = new Set();
data.aitest.groups.forEach(g => {
  if (!g.id || !g.name) errors.push('AI 测试分组缺少 id/name');
  g.items.forEach(it => {
    if (!it.id || !it.name) errors.push('AI 测试条目缺少 id/name');
    if (atIds.has(it.id)) errors.push('AI 测试条目 id 重复: ' + it.id);
    atIds.add(it.id);
    if (!MATURITY.has(it.maturity)) errors.push(`AI 测试条目 ${it.id} 的 maturity 无效: ${it.maturity}`);
    ['what', 'why', 'pos'].forEach(k => {
      if (!it[k]) errors.push(`AI 测试条目 ${it.id} 缺少 ${k}`);
    });
    ['good', 'bad'].forEach(k => {
      if (!Array.isArray(it[k]) || !it[k].length) errors.push(`AI 测试条目 ${it.id} 的 ${k} 必须是非空数组`);
    });
  });
});
if (!data.aitest.matrix || !Array.isArray(data.aitest.matrix.rows)) {
  errors.push('aitest.json 缺少 matrix.rows');
}

/* ---------- 市场变动校验 ---------- */
const EVENT_KINDS = new Set(Object.keys(data.events.kinds || {}));
data.events.events.forEach(e => {
  if (!e.date || !e.title) errors.push('市场变动缺少 date/title');
  if (!EVENT_KINDS.has(e.kind)) errors.push(`市场变动「${e.title}」的 kind 无效: ${e.kind}`);
  if (e.planId && !planIds.has(e.planId)) errors.push(`市场变动「${e.title}」引用了不存在的套餐 ${e.planId}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) errors.push(`市场变动「${e.title}」日期格式应为 YYYY-MM-DD`);
});
const evSorted = data.events.events.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
if (JSON.stringify(evSorted) !== JSON.stringify(data.events.events)) {
  warns.push('events.json 未按日期倒序排列（页面会自动排序，不影响显示）');
}

/* ---------- AI 大事校验 ---------- */
const NEWS_KINDS = new Set(Object.keys(data.news.kinds || {}));
const newsIds = new Set();
const allNews = [].concat(data.news.events || [], (data.newsAuto && data.newsAuto.events) || []);
allNews.forEach(e => {
  if (!e.id || newsIds.has(e.id)) errors.push('新闻 id 缺失或重复: ' + e.id);
  newsIds.add(e.id);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(e.date))) errors.push(`新闻「${e.title}」日期格式应为 YYYY-MM-DD`);
  if (['cn', 'global'].indexOf(e.region) < 0) errors.push(`新闻「${e.title}」region 非法: ${e.region}`);
  if (!e.auto && !NEWS_KINDS.has(e.kind)) errors.push(`新闻「${e.title}」kind 非法: ${e.kind}`);
  if (!e.title) errors.push('新闻缺少 title');
  if (!e.source || !e.source.url) errors.push(`新闻「${e.title}」缺少来源链接`);
  // 人工条目必须写对测试的影响；自动条目没人工复核，不强制
  if (!e.auto && (!e.impact || e.impact.length < 10)) errors.push(`新闻「${e.title}」必须写清对测试的影响`);
});
(data.news.events || []).forEach(e => {
  if (!/^https?:\/\//.test(String((e.source || {}).url || ''))) errors.push(`新闻「${e.title}」的来源必须是 http(s) 链接`);
});

/* ---------- 免费额度校验 ---------- */
const FB = data.freebies;
if (!FB || !Array.isArray(FB.items) || FB.items.length < 10) errors.push('freebies.json 至少要有 10 条免费额度');
const fbCats = new Set((FB.categories || []).map(c => c.id));
const FB_VALUES = new Set(['高', '中', '低', '无']);
const fbIds = new Set();
(FB.items || []).forEach(f => {
  if (!f.id || fbIds.has(f.id)) errors.push('免费额度 id 缺失或重复: ' + f.id);
  fbIds.add(f.id);
  if (!fbCats.has(f.cat)) errors.push(`免费额度 ${f.id} 的 cat 非法: ${f.cat}`);
  if (!FB_VALUES.has(f.value)) errors.push(`免费额度 ${f.id} 的 value 非法: ${f.value}`);
  ['name', 'vendor', 'amount', 'how', 'cap', 'trap'].forEach(k => { if (!f[k]) errors.push(`免费额度 ${f.id} 缺少 ${k}`); });
  if (f.trap && f.trap.length < 15) errors.push(`免费额度 ${f.id} 的 trap 太短`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(f.verified))) errors.push(`免费额度 ${f.id} 的 verified 应为 YYYY-MM-DD`);
  if (f.expiry && !/^\d{4}-\d{2}-\d{2}$/.test(f.expiry)) errors.push(`免费额度 ${f.id} 的 expiry 应为 YYYY-MM-DD 或 null`);
});
['cloud', 'model', 'agent', 'edu'].forEach(c => {
  if (!(FB.items || []).some(x => x.cat === c)) errors.push('免费额度缺少分类: ' + c);
});

/* ---------- 角色阶梯校验 ---------- */
const R = data.roles;
if (!R || !Array.isArray(R.roles) || R.roles.length < 10) errors.push('roles.json 至少要有 10 个角色');
if (!R || !Array.isArray(R.levels) || R.levels.length !== 3) errors.push('roles.json 必须有初级/中级/高级三档');
const roleIds = new Set((R.roles || []).map(x => x.id));
(R.roles || []).forEach(x => {
  ['name', 'en', 'oneLine', 'riskNote'].forEach(k => { if (!x[k]) errors.push(`角色 ${x.id} 缺少 ${k}`); });
  if ([1, 2, 3].indexOf(x.stage) < 0) errors.push(`角色 ${x.id} 的 stage 非法`);
  ['work', 'aiUse', 'human', 'metrics', 'tools'].forEach(k => {
    if (!Array.isArray(x[k]) || !x[k].length) errors.push(`角色 ${x.id} 的 ${k} 必须是非空数组`);
  });
  (x.tools || []).forEach(id => { if (!toolIds.has(id)) errors.push(`角色 ${x.id} 引用了不存在的工具 ${id}`); });
  if (x.next && !roleIds.has(x.next)) errors.push(`角色 ${x.id} 的 next 指向不存在的角色 ${x.next}`);
  if (typeof x.penetration !== 'number' || x.penetration < 0 || x.penetration > 100) errors.push(`角色 ${x.id} 的 penetration 必须是 0–100`);
});
if (!R.matrix || !Array.isArray(R.matrix.rows)) errors.push('roles.json 缺少 matrix.rows');
(R.matrix && R.matrix.rows || []).forEach(r => {
  if (!roleIds.has(r.role)) errors.push(`矩阵引用了不存在的角色 ${r.role}`);
  if (!Array.isArray(r.cells) || r.cells.length !== 3) errors.push(`矩阵角色 ${r.role} 必须有 3 个级别`);
  (r.cells || []).forEach(c => { if (!c.d || !c.ai) errors.push(`矩阵角色 ${r.role}/${c.l} 缺少 d 或 ai`); });
});
if (!R.relation || !Array.isArray(R.relation.quads) || R.relation.quads.length !== 4) errors.push('roles.json 的 AI×测试 关系必须是 4 个象限');

/* ---------- 冲击数据校验 ---------- */
const IMP = data.impact;
if (!IMP || !Array.isArray(IMP.numbers) || IMP.numbers.length < 6) errors.push('impact.json 至少要有 6 条数据');
(IMP.numbers || []).forEach((n, i) => {
  ['v', 'k', 'd', 'src'].forEach(k => { if (!n[k]) errors.push(`冲击数据第 ${i + 1} 条缺少 ${k}`); });
});
if (!IMP.matrix || !Array.isArray(IMP.matrix.rows) || IMP.matrix.rows.length < 6) errors.push('impact.json 的替代度矩阵至少 6 行');
if (!IMP.playbook || !Array.isArray(IMP.playbook.phases) || IMP.playbook.phases.length !== 3) errors.push('impact.json 的 90 天方案必须是 3 段');
if (!Array.isArray(IMP.antiPatterns) || IMP.antiPatterns.length < 4) errors.push('impact.json 至少 4 条反模式');
if (!IMP.selfCheck || !Array.isArray(IMP.selfCheck.qs) || IMP.selfCheck.qs.length < 4) errors.push('impact.json 自检至少 4 题');

/* ---------- AI 评测集校验 ----------
   评测集是「可执行物」，字段缺一个就没法跑：
   必须有类别、目标、输入、预期、判定器、严重级别，且 id 唯一。 */
const EVS = data.evalset;
if (!EVS || !Array.isArray(EVS.categories) || EVS.categories.length !== 6) {
  errors.push('evalset.json 必须有 6 个类别');
}
if (!EVS || !Array.isArray(EVS.cases) || EVS.cases.length !== 30) {
  errors.push(`evalset.json 必须有 30 条用例，现在是 ${EVS && EVS.cases ? EVS.cases.length : '缺失'}`);
}
const evCatIds = new Set((EVS && EVS.categories || []).map(c => c.id));
const evIds = new Set();
(EVS && EVS.cases || []).forEach(c => {
  if (!c.id || evIds.has(c.id)) errors.push(`评测用例 id 缺失或重复: ${c.id}`);
  evIds.add(c.id);
  if (!evCatIds.has(c.cat)) errors.push(`评测用例 ${c.id} 的类别不存在: ${c.cat}`);
  ['name', 'target', 'input', 'expected', 'oracle'].forEach(k => {
    if (!c[k]) errors.push(`评测用例 ${c.id} 缺少 ${k}`);
  });
  if (['P0', 'P1', 'P2'].indexOf(c.severity) < 0) errors.push(`评测用例 ${c.id} 的 severity 非法: ${c.severity}`);
});
if (!EVS || !Array.isArray(EVS.howto) || EVS.howto.length < 4) errors.push('evalset.json 的 howto 至少 4 步');
if (!EVS || !Array.isArray(EVS.metrics) || EVS.metrics.length < 4) errors.push('evalset.json 的 metrics 至少 4 项');
evCatIds.forEach(id => {
  const n = (EVS.cases || []).filter(c => c.cat === id).length;
  if (n < 4) errors.push(`评测类别 ${id} 少于 4 条用例（现在 ${n}）`);
});

/* ---------- 测试人诊断校验 ---------- */
const personaIds = Object.keys(data.persona.personas);
const phaseIds = new Set(data.roadmap.phases.map(p => p.id));
const usedKeys = new Set();

data.persona.questions.forEach(q => {
  if (!q.id || !q.text) errors.push('诊断题缺少 id/text');
  if (!Array.isArray(q.options) || q.options.length < 3) errors.push(`诊断题 ${q.id} 选项少于 3 个`);
  q.options.forEach(o => {
    if (!o.id || !o.label) errors.push(`诊断题 ${q.id} 有选项缺 id/label`);
    Object.keys(o.scores || {}).forEach(k => {
      if (personaIds.indexOf(k) < 0) errors.push(`诊断题 ${q.id}/${o.id} 引用了不存在的类别 ${k}`);
      usedKeys.add(k);
    });
  });
});

personaIds.forEach(k => {
  const p = data.persona.personas[k];
  ['name', 'emoji', 'code', 'tagline', 'profile', 'bundle', 'firstStep', 'pitfall', 'why', 'phase', 'level'].forEach(f => {
    if (!p[f]) errors.push(`类别 ${k} 缺少 ${f}`);
  });
  if (p.bundle && !bundleIds.has(p.bundle)) errors.push(`类别 ${k} 引用了不存在的组合 ${p.bundle}`);
  if (p.phase && !phaseIds.has(p.phase)) errors.push(`类别 ${k} 引用了不存在的阶段 ${p.phase}`);
  if (!Array.isArray(p.symptoms) || !p.symptoms.length) errors.push(`类别 ${k} 的 symptoms 必须是非空数组`);
});

const unreachable = personaIds.filter(k => !usedKeys.has(k));
if (unreachable.length) errors.push('这些类别在任何选项里都拿不到分，永远选不出来：' + unreachable.join(', '));

/* ---------- 我的判断校验 ---------- */
const OP = data.opinion;
if (!OP.title) errors.push('opinion.json 缺少 title');
if (!Array.isArray(OP.sections) || OP.sections.length < 3) errors.push('opinion.json 的 sections 至少要有 3 段');

const JUDGE_TONES = ['rose', 'cyan', 'violet', 'amber'];
(OP.sections || []).forEach(sec => {
  if (!sec.id || !sec.title) errors.push('opinion 段落缺少 id/title');
  (sec.cards || []).forEach((c, i) => {
    if (JUDGE_TONES.indexOf(c.tone) < 0) errors.push(`opinion/${sec.id} 第 ${i + 1} 张卡 tone 非法：${c.tone}`);
    if (!c.title || !c.body) errors.push(`opinion/${sec.id} 第 ${i + 1} 张卡缺 title/body`);
    if (!Array.isArray(c.members) || !c.members.length) errors.push(`opinion/${sec.id} 第 ${i + 1} 张卡 members 必须是非空数组`);
  });
  (sec.items || []).forEach((it, i) => {
    if (!it.n || !it.title || !it.body) errors.push(`opinion/${sec.id} 第 ${i + 1} 条判断缺 n/title/body`);
    if (!it.action) errors.push(`opinion/${sec.id} 第 ${i + 1} 条判断缺 action（判断必须给可执行的建议）`);
    if (!it.controversy) errors.push(`opinion/${sec.id} 第 ${i + 1} 条判断缺 controversy（有争议的判断必须写清边界）`);
  });
});

// 三种活法里提到的工具，必须都在 tools 里存在
const toolNameSet = new Set(Object.values(data.tools).map(t => t.name));
(OP.sections || []).forEach(sec => {
  (sec.cards || []).forEach(c => {
    (c.members || []).forEach(m => {
      if (!toolNameSet.has(m)) warns.push(`opinion 提到的工具「${m}」在 tools.json 里找不到同名项（可能只是叫法不同）`);
    });
  });
});

/* ---------- 优惠与免费额度校验 ---------- */
const PR = data.promos;
if (!PR.intro || !PR.intro.title) errors.push('promos.json 缺少 intro.title');

const PROMO_VALUES = new Set(['高', '中', '低', '无']);
const PROMO_TONES = ['cyan', 'violet', 'green', 'amber', 'rose'];
const PROMO_CATS = new Set(['model', 'agent']);
const PROMO_SRCS = new Set(['official', 'community']);

if (!Array.isArray(PR.freeTier) || PR.freeTier.length < 3) errors.push('promos.json 的 freeTier 至少要有 3 条');
(PR.freeTier || []).forEach(f => {
  if (!f.id || !f.vendor || !f.brand) errors.push('免费额度条目缺少 id/vendor/brand');
  if (!PROMO_VALUES.has(f.value)) errors.push(`免费额度 ${f.id} 的 value 非法: ${f.value}（只能是 高/中/低/无）`);
  if (!PROMO_CATS.has(f.cat)) errors.push(`免费额度 ${f.id} 的 cat 非法: ${f.cat}（只能是 model / agent）`);
  if (!PROMO_SRCS.has(f.src)) errors.push(`免费额度 ${f.id} 的 src 非法: ${f.src}（只能是 official / community）`);
  ['what', 'how', 'cap', 'trap', 'verified'].forEach(k => {
    if (!f[k]) errors.push(`免费额度 ${f.id} 缺少 ${k}`);
  });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.verified)) errors.push(`免费额度 ${f.id} 的 verified 应为 YYYY-MM-DD`);
  if (f.planId && !planIds.has(f.planId)) errors.push(`免费额度 ${f.id} 引用了不存在的套餐 ${f.planId}`);
  // 每条都必须写「坑」，这是本页的核心价值：只讲好处就是广告
  if (!f.trap || f.trap.length < 15) errors.push(`免费额度 ${f.id} 的 trap 太短，必须写清真实的坑`);
});

// 两类额度必须都有，否则页面会退化成「只有模型 API」或「只有 Agent 产品」
const ftCats = new Set((PR.freeTier || []).map(f => f.cat));
if (!ftCats.has('model')) errors.push('免费额度里没有 cat=model 的条目（模型 API 类）');
if (!ftCats.has('agent')) errors.push('免费额度里没有 cat=agent 的条目（Agent 产品类）');

/* 首购优惠的截止日必须机器可读：没有它，过期优惠会继续被当成有效优惠展示 */
const _d = new Date();
const TODAY = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`;

(PR.firstBuy || []).forEach(b => {
  if (!planIds.has(b.planId)) errors.push(`首购优惠引用了不存在的套餐 ${b.planId}`);
  ['name', 'promoNote', 'period', 'after', 'judge'].forEach(k => {
    if (!b[k]) errors.push(`首购优惠 ${b.planId} 缺少 ${k}`);
  });
  if (typeof b.list !== 'number' || typeof b.promo !== 'number') errors.push(`首购优惠 ${b.planId} 的 list/promo 必须是数字`);
  if (b.promo > b.list) errors.push(`首购优惠 ${b.planId} 的优惠价高于原价`);
  const pctOff = (1 - b.promo / b.list) * 100;
  if (pctOff < 0) errors.push(`首购优惠 ${b.planId} 折扣计算异常`);
  if (b.ends === undefined) {
    errors.push(`首购优惠 ${b.planId} 缺少 ends（YYYY-MM-DD 或显式 null；长期活动也必须写 null）`);
  } else if (b.ends != null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.ends)) {
      errors.push(`首购优惠 ${b.planId} 的 ends 应为 YYYY-MM-DD，现在是 ${JSON.stringify(b.ends)}`);
    } else if (b.ends < TODAY) {
      errors.push(`首购优惠 ${b.planId} 已于 ${b.ends} 过期——更新 period/promo 或删除该条，页面不能再把它当有效优惠展示`);
    }
  }
});

(PR.stacking || []).forEach(s => {
  if (PROMO_TONES.indexOf(s.tone) < 0) errors.push(`叠加层 tone 非法: ${s.tone}`);
  ['title', 'body'].forEach(k => { if (!s[k]) errors.push('叠加层缺少 ' + k); });
  if (typeof s.level !== 'number') errors.push('叠加层缺少数字 level（用于排序）');
});

(PR.offpeak || []).forEach(o => {
  if (o.planId && !planIds.has(o.planId) && !toolIds.has(o.planId)) {
    errors.push(`时段优惠引用了不存在的套餐/工具 ${o.planId}`);
  }
  ['name', 'window', 'rule', 'save', 'note'].forEach(k => {
    if (!o[k]) errors.push(`时段优惠「${o.name}」缺少 ${k}`);
  });
});

(PR.judgments || []).forEach(j => {
  if (!j.n || !j.title || !j.body) errors.push('优惠判断缺少 n/title/body');
  if (!j.action) errors.push(`优惠判断 ${j.n} 缺 action`);
  if (!j.controversy) errors.push(`优惠判断 ${j.n} 缺 controversy（有争议的判断必须写清边界）`);
});

/* ---------- 夺冠率门禁（蒙特卡洛） ----------
   为什么需要这道门禁：本站卖点是「换权重排名会变」。如果某个工具在任何
   随机权重下都赢，那这句话就是假的——用户一拖滑块发现答案不变，信任就没了。
   所以构建期就用固定种子抽 20000 组权重，统计各工具夺冠率；任何一款超过
   MAX_WIN_RATE 直接失败，逼着评分表保持「各有取舍」。
   ---------- */
const MAX_WIN_RATE = 40;      // 单一工具夺冠率上限（%）
const WIN_RUNS = 20000;        // 抽样次数
const WIN_SEED = 20261029;     // 固定种子：同一份数据每次构建得到同一结论
const MIN_WINNERS = 4;         // 至少几款工具要真能夺冠（>0）
const WINNER_FLOOR = 0.5;      // 夺冠率超过这个百分比才算「能夺冠」

/* 确定性伪随机（mulberry32）：不用 Math.random，保证门禁可复现 */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function winRates(n, seed) {
  const rnd = mulberry32(seed);
  const win = {};
  data.tools.forEach(t => win[t.id] = 0);
  let ties = 0;
  for (let i = 0; i < n; i++) {
    const w = {};
    let tot = 0;
    data.criteria.criteria.forEach(c => {
      const v = Math.floor(rnd() * 11);   // 0–10 均匀，与滑块范围一致
      w[c.id] = v;
      tot += v;
    });
    if (!tot) { i--; continue; }          // 全 0 权重没有意义，重抽
    let best = -Infinity, bestIds = [];
    data.tools.forEach(t => {
      let s = 0;
      data.criteria.criteria.forEach(c => { s += w[c.id] * (t.score[c.id] || 0); });
      s /= tot;
      if (s > best + 1e-12) { best = s; bestIds = [t.id]; }
      else if (Math.abs(s - best) <= 1e-12) bestIds.push(t.id);
    });
    // 并列第一按人数均分，避免平局被算给排在前面的那款
    if (bestIds.length > 1) ties++;
    bestIds.forEach(id => { win[id] += 1 / bestIds.length; });
  }
  const rates = data.tools
    .map(t => ({ id: t.id, name: t.name, pct: win[t.id] / n * 100 }))
    .sort((a, b) => b.pct - a.pct);
  return { rates, ties };
}

const { rates: winRatesList, ties: winTies } = winRates(WIN_RUNS, WIN_SEED);
const overLimit = winRatesList.filter(r => r.pct > MAX_WIN_RATE);
const winners = winRatesList.filter(r => r.pct > WINNER_FLOOR);

function formatWinTable(list) {
  const width = Math.max(...list.map(r => r.name.length));
  const lines = list.map((r, i) =>
    `  ${String(i + 1).padStart(2)}. ${r.name.padEnd(width)}  ${r.pct.toFixed(2).padStart(6)}%  ${'█'.repeat(Math.max(0, Math.round(r.pct / 2)))}`
  );
  return lines.join('\n');
}

if (overLimit.length) {
  errors.push(
    `夺冠率门禁未通过：${overLimit.map(r => `${r.name} ${r.pct.toFixed(2)}%`).join('、')} 超过 ${MAX_WIN_RATE}% 上限。\n` +
    `  随机抽 ${WIN_RUNS} 组权重（0–10 均匀）得到的完整分布：\n` +
    formatWinTable(winRatesList) +
    `\n  这说明评分表存在系统性偏向——某个工具在所有维度上都压过别人，` +
    `那「换权重排名会变」就是假的。请回到 data/tools.json 重新核查分数，` +
    `而不是调高这里的阈值。`
  );
}
if (winners.length < MIN_WINNERS) {
  errors.push(
    `夺冠率门禁未通过：只有 ${winners.length} 款工具能在随机权重下夺冠（要求至少 ${MIN_WINNERS} 款，` +
    `阈值 >${WINNER_FLOOR}%）。\n  完整分布：\n${formatWinTable(winRatesList)}`
  );
}

if (errors.length) {
  console.error('\n✗ 构建失败，数据有 ' + errors.length + ' 处错误：');
  errors.forEach(e => console.error('  · ' + e));
  process.exit(1);
}
if (warns.length) {
  console.warn('\n⚠ ' + warns.length + ' 条警告（不阻塞构建）：');
  warns.slice(0, 12).forEach(w => console.warn('  · ' + w));
  if (warns.length > 12) console.warn('  … 其余 ' + (warns.length - 12) + ' 条省略');
}

/* ---------- 3. 内联 ---------- */
let html = readText('index.html');
/* 样式分三层叠加：基础样式 → v4 报告台层 → v4 响应式层。
   顺序不能反：v4 覆盖基础，响应式必须最后（同特异性后者胜）。 */
const css = [
  readText('styles.css'),
  readText('v4.css'),
  readText('v4-responsive.css'),
  readText('v5.css'),
  readText('v6.css'),
  readText('v7.css')
].join('\n\n');
const js = readText('app.js');

const json = JSON.stringify(data);

html = html.replace('/*__CSS__*/', () => css);
html = html.replace('/*__DATA__*/', () => json);
html = html.replace('/*__JS__*/', () => js);

/* ---------- 4. 写出 ---------- */
fs.writeFileSync(OUT, html, 'utf8');

/* ---------- 4.1 开放数据集导出 ----------
   站点是单文件，但数据不应该锁在页面里。
   导出物由构建生成，不手改；health 页直接链到这些文件。 */
const EXPORT_DIR = path.join(ROOT, 'exports');
fs.mkdirSync(EXPORT_DIR, { recursive: true });
const csvCell = (v) => {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const planRows = data.plans.map(p => ({
  id: p.id,
  name: p.name,
  vendor: p.vendor,
  tier: p.tier,
  region: p.region,
  currency: p.currency || 'CNY',
  priceLocal: p.priceLocal != null ? p.priceLocal : p.price,
  priceCNY: p.price,
  form: p.form,
  formName: p.formName,
  quota: p.quota,
  verified: p.verified,
  restrictions: (p.restrictions || []).join(' | ')
}));
const planCsv = [
  Object.keys(planRows[0] || {}).join(','),
  ...planRows.map(r => Object.values(r).map(csvCell).join(','))
].join('\n') + '\n';

/* 生成时间取 meta.lastBuilt（日期），不用当前时刻。
   用时刻的后果：每次构建都产生 diff，仓库永远是「脏」的，
   自动更新工作流会刷出一堆「什么都没变」的提交。
   所以改数据后要顺手把 meta.lastBuilt 更新为今天，产物才会带上新的生成日期。 */
const BUILT_AT = data.meta.lastBuilt;
const planMd = [
  '# AI Test Stack · 套餐数据',
  '',
  `> 数据核验日：${data.meta.lastVerified} · 生成时间：${BUILT_AT} · 共 ${planRows.length} 档`,
  '> 价格仅用于同表比较，下单前以官网现价为准。',
  '',
  '| ID | 套餐 | 厂商 | 档位 | 地区 | 币种 | 当地价 | 人民币等值 | 形态 | 核验日 |',
  '|---|---|---|---|---|---|---:|---:|---|---|',
  ...planRows.map(r => `| ${r.id} | ${r.name} | ${r.vendor} | ${r.tier} | ${r.region} | ${r.currency} | ${r.priceLocal} | ¥${r.priceCNY} | ${r.formName || r.form} | ${r.verified} |`)
].join('\n') + '\n';
const manifest = {
  site: data.meta.siteName,
  version: data.meta.version,
  generatedAt: BUILT_AT,
  lastVerified: data.meta.lastVerified,
  fx: data.meta.fx,
  counts: {
    tools: data.tools.length,
    plans: data.plans.length,
    bundles: data.bundles.length,
    freebies: (data.freebies.items || []).length,
    news: (data.news.events || []).length,
    roles: (data.roles.roles || []).length,
    evalsetCases: (data.evalset.cases || []).length
  },
  files: ['tools.json', 'plans.json', 'plans.csv', 'plans.md', 'evalset.json', 'manifest.json']
};
fs.writeFileSync(path.join(EXPORT_DIR, 'tools.json'), JSON.stringify(data.tools, null, 2) + '\n', 'utf8');
fs.writeFileSync(path.join(EXPORT_DIR, 'plans.json'), JSON.stringify(data.plans, null, 2) + '\n', 'utf8');
fs.writeFileSync(path.join(EXPORT_DIR, 'evalset.json'), JSON.stringify(data.evalset, null, 2) + '\n', 'utf8');
fs.writeFileSync(path.join(EXPORT_DIR, 'plans.csv'), planCsv, 'utf8');
fs.writeFileSync(path.join(EXPORT_DIR, 'plans.md'), planMd, 'utf8');
fs.writeFileSync(path.join(EXPORT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
const stat = {
  tools: data.tools.length,
  plans: data.plans.length,
  bundles: data.bundles.length,
  caps: capIds.size,
  crit: critIds.size,
  phases: data.roadmap.phases.length,
  log: data.changelog.length
};
const formLabel = { coding: 'Coding', token: 'Token', agent: 'Agent', member: '会员', paygo: '按量' };
const formLine = Object.entries(formCount).map(([k, v]) => `${formLabel[k] || k} ${v}`).join(' · ');
console.log(`\n✓ 构建完成 → index.html (${kb} KB)`);
console.log(`  工具 ${stat.tools} · 套餐 ${stat.plans}（${formLine}） · 组合 ${stat.bundles}`);
console.log(`  能力 ${stat.caps} · 维度 ${stat.crit} · 阶段 ${stat.phases} · 日志 ${stat.log}`);
console.log(`  优惠：免费额度 ${PR.freeTier.length} · 首购 ${(PR.firstBuy || []).length} · 时段 ${(PR.offpeak || []).length}`);
console.log(`  数据核验日：${data.meta.lastVerified}`);
console.log(`  新闻 ${allNews.length}（人工 ${(data.news.events || []).length} + 自动 ${(data.newsAuto.events || []).length}） · 免费额度 ${(data.freebies.items || []).length} · 角色 ${(data.roles.roles || []).length} · 评测集 ${(data.evalset.cases || []).length}`);
console.log(`  数据导出 ${manifest.files.length} 个 → exports/（tools / plans / evalset / manifest）`);
console.log(`  自动更新：${data.refreshReport ? data.refreshReport.at + '（' + ((data.renderReport || data.refreshReport).news ? (data.refreshReport.news.fetched || 0) + ' 条新增' : '无新闻') + '）' : '尚未运行'} `);
