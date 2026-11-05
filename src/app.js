/* =========================================================
   AI Test Stack — app
   ========================================================= */
(function () {
  'use strict';

  const D = window.__DATA__ || {};
  /* 站点身份由 build.js 注入（仓库地址、绝对 URL、版本）。
     本地没有 git remote 时是空对象——纠错入口会退化成「复制模板」，不会指向错误地址。 */
  const SITE = window.__SITE__ || {};
  const META = D.meta || {};
  const TOOLS = D.tools || [];
  const PLANS = D.plans || [];
  const CAPS = D.capabilities || { groups: [], levels: [] };
  const CRIT = D.criteria || { criteria: [], planCriteria: [], profiles: {}, planProfiles: {} };
  const ROAD = D.roadmap || { phases: [], judgments: [], stacks: [] };
  const LOG = D.changelog || [];
  const SRC = D.sources || { groups: [], method: [], caveats: [] };
  const BUNDLES = D.bundles || [];
  const AT = D.aitest || { groups: [], matrix: { rows: [] }, judgments: [] };
  const EV = D.events || { events: [], kinds: {}, coverage: {} };
  const PE = D.persona || { questions: [], personas: {} };
  const OP = D.opinion || { sections: [] };
  const PR = D.promos || { freeTier: [], firstBuy: [], stacking: [], offpeak: [], judgments: [], caveats: [] };
  const PP = D.planpack || { meta: { weeks: [] }, tasks: [], guards: [], cmd: {} };
  const NEWS = D.news || { events: [], kinds: {}, intro: {} };
  const NEWS_AUTO = D.newsAuto || { events: [] };
  const FB = D.freebies || { categories: [], items: [], intro: {} };
  const ROLE = D.roles || { roles: [], levels: [], matrix: { rows: [] }, relation: { quads: [] }, sources: [] };
  const IMP = D.impact || { numbers: [], shifts: [], matrix: { rows: [] }, playbook: { phases: [] }, antiPatterns: [], selfCheck: { qs: [] }, sources: [] };
  const EVS = D.evalset || { categories: [], cases: [], howto: [], metrics: [], scoring: { bands: [] }, intro: {} };
  /* 社区资源库：人工判断与脚本抓取分两份存。
     CM 是人写的（这是什么、对测试怎么用），CMS 是每周从 GitHub 抓的（星数、最近提交）。
     合起来渲染，但永远不互相覆盖——CI 刷新星数时不能碰人写的那半。 */
  const CM = D.community || { categories: [], items: [], intro: {} };
  const CMS = (D.communityStats || {}).repos || {};
  const CM_CAT = {};
  (CM.categories || []).forEach(c => { CM_CAT[c.id] = c; });
  const RR = D.refreshReport || null;
  /* 导航与站务页内容：从 data/nav.json / data/pages.json 读。
     以前顶栏、页脚、移动导航三处各写一份，加一页要改三处；现在只改配置。 */
  const NAV = D.nav || { primary: [], footer: [], mobile: { primary: [], more: [] }, redirects: {}, reserved: [] };
  const PAGES = D.pages || {};
  const PROV = (CRIT && CRIT.provenanceLevels) || {};
  // 短别名：这两个在后面出现频率太高，每次写 CRIT.criteria 太吵
  const CRITERIA = CRIT.criteria || [];
  const PROFILES = CRIT.profiles || {};

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rnd = (n) => Math.round(n);

  /* ---------- capability index ---------- */
  const CAP_LIST = [];
  const CAP_GROUP = {};
  CAPS.groups.forEach(g => g.items.forEach(it => {
    CAP_LIST.push(Object.assign({ group: g.id, groupName: g.name, groupIcon: g.icon }, it));
    CAP_GROUP[it.id] = g;
  }));

  const LEVEL = {};
  (CAPS.levels || []).forEach(l => LEVEL[l.v] = l);

  /* ---------- scoring ---------- */
  function toolScore(t, weights) {
    let s = 0, tot = 0;
    CRIT.criteria.forEach(c => {
      const w = weights[c.id] || 0;
      if (!w) return;
      s += w * (t.score[c.id] || 0);
      tot += w;
    });
    return tot ? s / tot : 0;
  }
  function capAvg(t) {
    const v = CAP_LIST.map(c => (t.capabilities || {})[c.id] || 0);
    return v.reduce((a, b) => a + b, 0) / (v.length || 1);
  }
  function planScore(p, weights) {
    let s = 0, tot = 0;
    CRIT.planCriteria.forEach(c => {
      const w = weights[c.id] || 0;
      if (!w) return;
      s += w * (p.s[c.id] || 0);
      tot += w;
    });
    return tot ? s / tot : 0;
  }

  /* 解释「它为什么赢」：找出冠亚军差距最大的两个维度（按权重放大后） */
  function whyWin(a, b, crits, weights, getScore) {
    if (!a || !b) return '';
    const ds = crits.map(c => {
      const w = weights[c.id] || 0;
      const d = (getScore(a)[c.id] || 0) - (getScore(b)[c.id] || 0);
      return { name: c.name, icon: c.icon, d, w, impact: d * w };
    }).filter(x => x.impact > 0).sort((x, y) => y.impact - x.impact);
    if (!ds.length) return '';
    return ds.slice(0, 2).map(x => `${x.icon}${x.name} 领先 ${x.d} 分`).join(' · ');
  }

  /* ---------- state ---------- */
  const state = {
    view: 'home',
    weights: {},
    profile: 'aitest',
    cnOnly: false,
    scriptOnly: false,
    budget: 200,
    toolQuery: '',
    capSort: 'avg',
    planWeights: {},
    planProfile: 'daily',
    planType: 'all',
    bundleProfile: 'all',
    evKind: 'all',
    ftCat: 'all',
    toolKind: 'all',
    toolRegion: 'all',
    planRegion: 'all',
    planLimit: 20,
    /* v9：表头排序。key 为空 = 跟随画像；一旦手点就由它接管表格顺序，
       但「冠军/亚军」结论永远按综合分算，不跟着价格排序跑。 */
    planSort: { key: '', dir: 'desc' },
    newsRegion: 'all',
    newsKind: 'all',
    newsQ: '',
    newsAuto: false,
    freeCat: 'all',
    freeRegion: 'all',
    /* 社区资源库：分类与排序都进 URL，分享出去要能还原同一个视图 */
    cmCat: 'all',
    cmSort: 'pick',
    roleId: 'blackbox',
    roleStage: 1,
    impCheck: [],
    evalCat: 'all',
    evalQ: '',
    vsA: 'dsh',
    vsB: 'cc',
    peStep: 0,
    peAnswers: [],
    peDone: false,
    pickedPlans: JSON.parse(localStorage.getItem('ats_picked') || '[]'),
    pickedTools: JSON.parse(localStorage.getItem('ats_stack') || '[]')
  };
  function applyProfile(id) {
    state.profile = id;
    state.weights = Object.assign({}, CRIT.profiles[id].w);
  }
  function applyPlanProfile(id) {
    state.planProfile = id;
    state.planWeights = Object.assign({}, CRIT.planProfiles[id].w);
  }
  applyProfile('aitest');
  applyPlanProfile('daily');

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), 1900);
  }

  /* ---------- color helpers ---------- */
  function barGrad(v) {
    if (v >= 4) return 'linear-gradient(90deg,#2fe3d4,#7ef5cf)';
    if (v >= 3) return 'linear-gradient(90deg,#5aa9ff,#8ec5ff)';
    return 'linear-gradient(90deg,#ff7a8a,#ffa8b3)';
  }
  function lvClass(v) { return 'lv' + Math.max(1, Math.min(5, Math.round(v))); }

  /* =========================================================
     ROUTER + 引导层（五层结构：首页 → 地图 → 模块 → 功能 → 完整站）
     ---------------------------------------------------------
     旧 16 个视图 id 原样保留 = 旧链接/旧分享链接零失效。
     新增：home（默认落地页）、map、all、mod-*（模块页）、404。
     ========================================================= */
  /* 8 个内容页。每一页内部是按「要办的事」分的区块（.sec），区块之间有分隔，
     顶部有章节条。旧的功能页 id 全部保留为跳转别名，老链接和分享链接不会失效。 */
  const IA = [
    { id: 'home', name: '首页', tag: '三问诊断：说清你在做什么，当场出方案', secs: [] },
    { id: 'tools', name: '工具', tag: '29 款工具的档案、能力图谱、两两对比、决策矩阵', secs: [['tools', '工具库'], ['capabilities', '能力图谱'], ['versus', '两两 PK'], ['matrix', '决策矩阵'], ['overview', '总览表']] },
    { id: 'plans', name: '价格', tag: '59 档套餐的实际月价、优惠、免费额度', secs: [['plans', '套餐对比'], ['promos', '优惠与白嫖'], ['free', '白嫖地图']] },
    { id: 'stacks', name: '方案', tag: '把选好的工具拼成一套能落地的组合', secs: [['bundles', '组合方案'], ['stack', '我的组合'], ['plan', '执行包'], ['report', '决策报告'], ['opinion', '我的判断']] },
    { id: 'signal', name: '动向', tag: 'AI 大事、价格变动、对测试岗位的影响', secs: [['news', 'AI 大事'], ['events', '市场变动'], ['impact', 'AI 对测试的冲击']] },
    { id: 'career', name: '角色', tag: '角色阶梯、成长路线、测试人自测', secs: [['roles', '角色阶梯'], ['roadmap', '成长路线'], ['persona', '测试人自测']] },
    { id: 'library', name: '资源', tag: '开源项目、评测集、AI 测试资料', secs: [['community', '社区资源库'], ['evalset', 'AI 评测集'], ['aitest', 'AI 测试专项']] },
    { id: 'data', name: '数据', tag: '每条的出处、核验日、改过什么', secs: [['health', '数据健康'], ['sources', '数据源与口径'], ['changelog', '更新日志']] }
  ];
  const FEATURE_VIEWS = IA.map(x => x.id);
  /* 旧 id → 新页面。合并前每个功能页都是独立地址，站上线过、分享链接在外面，
     直接删会变成一堆 404——所以这里做别名，旧地址自动落到新页面。 */
  const SEC_OF = {};
  IA.forEach(p => p.secs.forEach(([s, label]) => { SEC_OF[s] = { page: p.id, sec: s, label }; }));
  const REDIRECTS = { map: 'home', all: 'home', 'mod-start': 'home', 'mod-diagnose': 'home', 'mod-grow': 'career', 'mod-shift': 'signal', 'mod-toolkit': 'tools', 'mod-choose': 'plans', 'mod-data': 'data' };
  Object.keys(SEC_OF).forEach(k => { if (!REDIRECTS[k]) REDIRECTS[k] = SEC_OF[k].page; });
  /* 站务页：不属于任何内容模块（它们不是「事」，是「站」本身）。
     和功能页一样是一级页面，但没有模块归属，所以面包屑只到「首页 › 页名」。 */
  const SITE_PAGES = ['search', 'mine', 'feedback', 'about', 'help', 'privacy', 'contact'];
  const VIEWS = ['home', ...FEATURE_VIEWS, ...SITE_PAGES, '404', 'error'];
  /* 文案里的计数占位符。站规是「计数一律运行时算」，但 data/pages.json 里
     一直手写着「57 档」「29 款」——数据涨到 59 档，页面上就成了假话。
     现在写 `{count:plans}`，渲染时从数据取。 */
  const COUNTS = {
    tools: TOOLS.length, plans: PLANS.length, bundles: BUNDLES.length,
    caps: CAP_LIST.length, free: (FB.items || []).length,
    news: (NEWS.events || []).length, roles: (ROLE.roles || []).length,
    evalset: (EVS.cases || []).length, community: (CM.items || []).length,
    views: FEATURE_VIEWS.length
  };
  const VIEW_NAME = {
    home: '首页', '404': '页面不存在', error: '页面出错',
    search: '全站搜索', mine: '个人中心', feedback: '反馈',
    about: '关于本站', help: '帮助与说明', privacy: '隐私与条款', contact: '联系方式'
  };
  Object.keys(SEC_OF).forEach(k => { VIEW_NAME[k] = SEC_OF[k].label; });
  IA.forEach(p => { VIEW_NAME[p.id] = p.name; });

  /* ---------- 轻量埋点：验证用户是否按预期路径走 ---------- */
  function track(n, p) {
    try {
      const arr = JSON.parse(localStorage.getItem('ats_events') || '[]');
      arr.push({ t: Date.now(), n, p: p || {} });
      if (arr.length > 500) arr.splice(0, arr.length - 500);
      localStorage.setItem('ats_events', JSON.stringify(arr));
    } catch (e) {}
  }
  window.atsTrackDump = () => { try { return JSON.parse(localStorage.getItem('ats_events') || '[]'); } catch (e) { return []; } };
  window.atsTrackClear = () => { try { localStorage.removeItem('ats_events'); } catch (e) {} };

  /* ---------- 本地收藏 / 浏览历史 ----------
     没有账号，所以「我的」不是服务端的一份档案，而是这台设备上的几个 key。
     好处是不会有任何数据离开浏览器；代价是换设备要自己导出。
     这里把读写集中成两个函数：一处 try/catch，免得无痕模式下每次点收藏都抛。 */
  const LS = {
    fav: 'ats_fav', recent: 'ats_recent', fb: 'ats_fb',
    theme: 'ats_theme', stack: 'ats_stack', picked: 'ats_picked',
    diag: 'ats_diag', events: 'ats_events', plan: 'ats_plan', planprog: 'ats_planprog'
  };
  function lsGet(k, dflt) {
    try { const raw = localStorage.getItem(k); return raw == null ? dflt : JSON.parse(raw); } catch (e) { return dflt; }
  }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

  let FAV = lsGet(LS.fav, []);
  if (!Array.isArray(FAV)) FAV = [];
  let RECENT = lsGet(LS.recent, []);
  if (!Array.isArray(RECENT)) RECENT = [];

  function favHas(k, id) { return FAV.some(x => x.k === k && x.id === id); }
  function favToggle(item) {
    const i = FAV.findIndex(x => x.k === item.k && x.id === item.id);
    if (i >= 0) { FAV.splice(i, 1); lsSet(LS.fav, FAV); return false; }
    FAV.unshift(Object.assign({ t: Date.now() }, item));
    if (FAV.length > 120) FAV.length = 120;
    lsSet(LS.fav, FAV);
    return true;
  }
  /* 收藏按钮：一个模板函数，工具卡 / 组合卡 / 功能页底部共用，
     免得三处各写一份 aria 与状态同步逻辑。 */
  function favBtn(kind, id, name) {
    const on = favHas(kind, id);
    return `<button class="favb${on ? ' on' : ''}" type="button" data-fav="${kind}" data-fav-id="${esc(id)}" data-fav-n="${esc(name)}" aria-pressed="${on}" aria-label="${on ? '取消收藏' : '收藏'} ${esc(name)}" title="${on ? '取消收藏' : '收藏'}"><span aria-hidden="true">${on ? '★' : '☆'}</span></button>`;
  }
  function syncFavButtons() {
    $$('[data-fav]').forEach(b => {
      const on = favHas(b.dataset.fav, b.dataset.favId);
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
      const s = b.querySelector('span'); if (s) s.textContent = on ? '★' : '☆';
      b.title = on ? '取消收藏' : '收藏';
      b.setAttribute('aria-label', (on ? '取消收藏 ' : '收藏 ') + (b.dataset.favN || ''));
    });
  }

  function pushRecent(v) {
    if (!v || v === '404' || v === 'error') return;
    const i = RECENT.findIndex(x => x.v === v);
    if (i >= 0) RECENT.splice(i, 1);
    RECENT.unshift({ v: v, t: Date.now() });
    if (RECENT.length > 50) RECENT.length = 50;
    lsSet(LS.recent, RECENT);
  }

  /* ---------- 顶部子导航：面包屑 + 模块内功能切换（进模块才出现） ---------- */
  function chromeFor(v) {
    const sub = $('#subnav');
    if (!sub) return;
    if (v === 'home') { sub.hidden = true; sub.innerHTML = ''; return; }
    // 只有两层了：首页 › 当前页。章节切换在页面顶部那条 secNav 里。
    sub.innerHTML = `<div class="crumbs" aria-label="面包屑"><a href="#home">首页</a><span class="csep">›</span><b>${esc(VIEW_NAME[v] || v)}</b></div>`;
    sub.hidden = false;
  }

  /* ---------- 页面底部引导：其他页面 + 收藏 / 报错 ----------
     以前这里是「同一模块的兄弟页」，合并后兄弟页就是同一页的章节，
     所以改成指向另外 7 个页面——它现在是「横向出口」，不是「层级出口」。 */
  function guideFor(v) {
    const sec = $('#v-' + v);
    if (!sec) return;
    let g = $('.pguide', sec);
    if (FEATURE_VIEWS.indexOf(v) < 0 || v === 'home') { if (g) g.remove(); return; }
    if (!g) { g = document.createElement('div'); g.className = 'panel pguide'; sec.appendChild(g); }
    const others = IA.filter(p => p.id !== v && p.id !== 'home')
      .map(p => `<a class="gchip" href="#${p.id}">${esc(p.name)}</a>`).join('');
    g.innerHTML = `
      <div class="grow">
        <div class="gcol">
          <div class="gk">换一页</div>
          <div class="gchips"><a class="gchip" href="#home">首页</a>${others}</div>
        </div>
        <div class="gcol">
          <div class="gk">这一页</div>
          <div class="gchips">
            ${favBtn('page', v, VIEW_NAME[v] || v)}
            <a class="gchip" href="#feedback" data-fb-page="${esc(v)}">✉ 这一页有问题</a>
          </div>
        </div>
      </div>`;
  }

  /* ---------- 首页动态层：数字滚动 / 工具跑马灯 / 选型引擎演示台 ----------
     全部纯 CSS + 本地数据，无外部依赖；prefers-reduced-motion 下退化为静态。 */
  function countUp() {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    $$('#v-home .num').forEach(el => {
      const target = +el.dataset.n || 0;
      if (reduce || el.dataset.counted) { el.textContent = target; return; }
      el.dataset.counted = '1';
      const t0 = performance.now(), dur = 900;
      (function tick(now) {
        const p = Math.min(1, (now - t0) / dur);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))); // easeOutCubic
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
    });
  }

  /* ---------- 首页诊断台：3 问出一份组合方案 ----------
     不假装大模型：这是跑在本地数据上的规则引擎——
     预算做硬过滤，目标和红线映射到组合的六维分（bundles.json 的 s 字段），
     每条推荐都能指回数据文件里的实价与评分。 */
  const DIAG_QS = [
    { k: 'goal', q: '你现在最想解决什么？', opts: [
      { v: 'regress', n: '日常回归自动化', w: { ci: 3, coding: 2, test: 1.5 } },
      { v: 'design', n: '写用例 / 测试设计', w: { coding: 3, test: 2 } },
      { v: 'learn', n: '先学 AI 测试', w: { ease: 3, value: 2.5 } },
      { v: 'team', n: '团队协作共享', w: { flex: 2.5, cn: 1.5, coding: 1.5 } }
    ] },
    { k: 'budget', q: '每个月愿意花多少电费？', opts: [
      { v: '50', n: '¥50 以内' }, { v: '100', n: '¥100 以内' },
      { v: '300', n: '¥300 以内' }, { v: 'any', n: '先不设限' }
    ] },
    { k: 'cstr', q: '有没有不能碰的红线？', opts: [
      { v: 'cn', n: '代码数据不能出境', w: { cn: 3 } },
      { v: 'ci', n: '必须能进 CI 流水线', w: { ci: 3 } },
      { v: 'ease', n: '上手必须简单', w: { ease: 2.5 } },
      { v: 'none', n: '没有硬约束', w: { value: 1 } }
    ] }
  ];
  let diag = { step: 0, ans: {}, phase: 'ask', done: false };
  function diagReset() { diag = { step: 0, ans: {}, phase: 'ask', done: false }; }
  const diagOpt = (k, v) => { const q = DIAG_QS.find(x => x.k === k); return q ? q.opts.find(o => o.v === v) : null; };

  function diagScore() {
    const cap = diag.ans.budget === 'any' ? Infinity : +diag.ans.budget;
    let pool = BUNDLES.filter(b => b.monthlyCost <= cap);
    let fallback = false;
    if (!pool.length) { pool = BUNDLES.slice(); fallback = true; }
    const gw = (diagOpt('goal', diag.ans.goal) || { w: {} }).w;
    const cw = (diagOpt('cstr', diag.ans.cstr) || { w: {} }).w;
    const scored = pool.map(b => {
      let s = 0;
      Object.keys(gw).forEach(k => { s += (gw[k] || 0) * (b.s[k] || 0); });
      Object.keys(cw).forEach(k => { s += (cw[k] || 0) * (b.s[k] || 0); });
      const tags = b.tags || [];
      if (diag.ans.cstr === 'cn' && tags.indexOf('国内直连') >= 0) s += 2;
      if (diag.ans.cstr === 'ci' && tags.indexOf('可脚本化') >= 0) s += 2;
      if (diag.ans.cstr === 'ease' && (b.s.ease || 0) >= 7) s += 1.5;
      return { b, s };
    }).sort((a, b) => b.s - a.s);
    return { top: scored[0], alt: scored[1], fallback, cap };
  }

  /* ---------- 诊断报告：额度判断（固定中度基线，不跟随计算器滑块） ----------
     单位不同不能直接比：次请求 / Credits / AFP 先按官方口径折算成用量，再除月度额度。 */
  const DIAG_USAGE = { hours: 4, turns: 12, ctx: 2.5, batch: 20 };
  function quotaVerdict(pid) {
    const m = QUOTA_MODEL[pid];
    if (!m) return null;
    const turnsPerDay = DIAG_USAGE.hours * DIAG_USAGE.turns;
    const perTurn = TOK_PER_TURN.base * DIAG_USAGE.ctx;
    const perMonthTok = turnsPerDay * perTurn * (1 + DIAG_USAGE.batch / 100 * 0.6) * 22;
    if (m.unit === '按量') return { v: '按量计费', cls: 'ok', pct: 0, note: '无月度上限，用多少付多少，账单没有封顶' };
    let need;
    if (m.unit === '次请求') need = turnsPerDay * 22;
    else if (m.unit === 'Credits' && pid === 'mimo') need = perMonthTok / 4000;
    else if (m.unit === 'Credits' && pid === 'bailian') need = perMonthTok / 3000;
    else if (m.unit === 'Credits' && pid === 'qoder') need = perMonthTok / 8000;
    else if (m.unit === 'AFP') need = perMonthTok / 3000;
    else need = perMonthTok;
    const ratio = need / m.monthly;
    const pct = Math.round(ratio * 100);
    return {
      v: ratio <= 0.6 ? '够用' : ratio <= 1.1 ? '刚好卡住' : '不够',
      cls: ratio <= 0.6 ? 'ok' : ratio <= 1.1 ? 'warn' : 'bad',
      pct, note: `按每天 ${turnsPerDay} 轮中度用法，占用月度额度约 ${pct}%；额度和限流是两件事，晚高峰仍可能被 429`
    };
  }

  /* 升级路径：在多花钱的组合里找第一个"加权分确实更高"的，而不是简单取下一档 */
  function upgradeOf(b, score) {
    const cands = BUNDLES.filter(x => x.monthlyCost > b.monthlyCost && x.id !== b.id)
      .sort((a, b2) => a.monthlyCost - b2.monthlyCost);
    for (const x of cands) {
      const s = diagWeighted(x);
      if (s > score * 1.03) return { b: x, s, diff: x.monthlyCost - b.monthlyCost };
    }
    return null;
  }
  function diagWeighted(b) {
    const gw = (diagOpt('goal', diag.ans.goal) || { w: {} }).w;
    const cw = (diagOpt('cstr', diag.ans.cstr) || { w: {} }).w;
    let s = 0;
    Object.keys(gw).forEach(k => { s += (gw[k] || 0) * (b.s[k] || 0); });
    Object.keys(cw).forEach(k => { s += (cw[k] || 0) * (b.s[k] || 0); });
    return s;
  }

  function diagReportHtml() {
    const r = diagScore();
    const b = r.top && r.top.b;
    if (!b) return '<div class="dmsg bot">数据里暂时没有可用组合。</div>';
    const plan = PLANS.find(p => p.id === b.plan) || null;
    const tool = TOOLS.find(t => t.id === b.tool) || null;
    // 与「我的组合」同一口径：开源壳算 ¥0，否则报告里会出现 60+40 却合计 40 的错账
    const shellPrice = shellCost(tool);
    const q = quotaVerdict(b.plan);
    const up = upgradeOf(b, diagWeighted(b));
    const reasons = [];
    if ((b.why || [])[0]) reasons.push(b.why[0]);
    if (diag.ans.cstr === 'cn') reasons.push((b.tags || []).indexOf('国内直连') >= 0 ? '国内直连、人民币付款，代码数据不出境' : '注意：这套组合不完全满足「不出境」，请在组合页核对');
    if (diag.ans.cstr === 'ci') reasons.push((b.tags || []).indexOf('可脚本化') >= 0 ? '壳有 CLI / API，能被 pytest 直接调用进流水线' : '注意：这套组合进 CI 要绕一步，组合页里有说明');
    const alt = r.alt && r.alt.b;
    return `
      <div class="dreport" role="status">
        <div class="drhead"><span class="dstamp" aria-hidden="true">PASS</span>
          <span class="drn">${esc(b.name)}<span class="drp">${esc(b.title || '')}${r.fallback ? ' · 预算内无现成组合，这是最接近的' : ''}</span></span>
          <span class="drprice"><b>¥${b.monthlyCost}</b><i>每月总成本</i></span>
        </div>
        <div class="dcost">
          <div><small>壳 · ${esc(tool ? (tool.license || '工具') : '工具')}</small><b>¥${shellPrice}</b></div>
          <div><small>电 · ${esc(plan ? (plan.tier || plan.name) : b.planName || '套餐')}</small><b>¥${plan ? plan.price : Math.max(0, b.monthlyCost - shellPrice)}</b></div>
          <div class="sum"><small>合计</small><b>¥${b.monthlyCost}/月</b></div>
        </div>
        ${reasons.slice(0, 2).map(x => `<div class="drrow"><i class="j">理由</i><p>${esc(x)}</p></div>`).join('')}
        ${q ? `<div class="drrow"><i class="${q.cls}">额度</i><p>${esc(q.v)} —— ${esc(q.note)}</p></div>` : ''}
        ${b.watch ? `<div class="drrow"><i class="risk">注意</i><p>${esc(b.watch)}</p></div>` : ''}
        ${up
          ? `<div class="drrow"><i>升级</i><p>+¥${up.diff}/月 换 ${esc(up.b.name)}：${esc((up.b.why || [])[0] || up.b.title || '')}</p></div>`
          : '<div class="drrow"><i>升级</i><p>按你这组权重，再加预算也买不到更优解——更高的档位只多出你用不上的能力。</p></div>'}
        <div class="dralt">备选：${alt ? esc(alt.name) + ' · ¥' + alt.monthlyCost + '/月' : '—'}。完整评分与坑位见 <a href="#bundles">组合方案页</a>。</div>
        <div class="drActs">
          <button type="button" class="btn sm primary" data-goplan>生成执行包 →</button>
          <button type="button" class="btn sm" data-save>采纳</button>
          <button type="button" class="btn sm" data-export>导出</button>
          <button type="button" class="btn sm" data-redo>重测</button>
        </div>
      </div>`;
  }

  /* 全量重绘而不是增量 append：离开首页再回来，状态也能原样恢复 */
  function diagHtml() {
    const l = $('#dlog'); if (!l) return;
    const opts = $('#dopts'), meter = $('#dmeter'), box = $('#diag');
    if (box) box.classList.toggle('done', diag.done);
    // 三步进度条：题目答到哪一步直接可见，面板在未答题时也有骨架，不会一片空
    const steps = $('#dsteps');
    if (steps) {
      steps.innerHTML = DIAG_QS.map((q, i) => {
        const cls = diag.done || i < diag.step ? 'ok' : i === diag.step ? 'cur' : '';
        const label = { goal: '目标', budget: '预算', cstr: '红线' }[q.k] || '第' + (i + 1) + '问';
        return `<div class="${cls}"><i>0${i + 1}</i>${label}</div>`;
      }).join('');
    }
    const parts = [];
    if (diag.done) {
      parts.push(diagReportHtml());
      if (opts) opts.innerHTML = '';
      if (meter) meter.hidden = true;
    } else if (diag.phase === 'gen') {
      parts.push('<div class="dmsg bot">在比了——预算做硬过滤，目标和红线当权重。</div>');
      if (opts) opts.innerHTML = '';
      if (meter) {
        meter.hidden = false;
        const tx = $('#dMeterTx');
        if (tx) tx.textContent = `比对 ${BUNDLES.length} 套组合 × ${CAP_LIST.length} 项能力 × 实价…`;
      }
    } else if (diag.phase === 'think') {
      parts.push('<div class="dmsg typing" aria-label="对方正在输入"><i></i><i></i><i></i></div>');
      if (opts) opts.innerHTML = '';
      if (meter) meter.hidden = true;
    } else {
      const q = DIAG_QS[diag.step];
      if (diag.step === 0) {
        parts.push('<div class="dmsg bot">我用 3 个问题给你配一套组合——按本站核过的实价和 20 项能力算，不注册、不用等。</div>');
      } else {
        const prev = DIAG_QS[diag.step - 1];
        const po = diagOpt(prev.k, diag.ans[prev.k]);
        parts.push(`<div class="dmsg me">已选：${esc(po ? po.n : '')}</div>`);
      }
      parts.push(`<div class="dmsg bot qline"><small>0${diag.step + 1} / 03</small>${esc(q ? q.q : '')}</div>`);
      if (opts) {
        opts.innerHTML = (q ? q.opts : []).map((o, i) =>
          `<button type="button" class="dchip" data-v="${esc(o.v)}"><i>${'ABCD'[i] || '·'}</i><span>${esc(o.n)}</span><b aria-hidden="true">→</b></button>`).join('');
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        $$('#dopts .dchip').forEach(b => b.onclick = () => diagAnswer(b.dataset.v, reduce));
      }
      if (meter) meter.hidden = true;
    }
    l.innerHTML = parts.join('');
    const cur = () => (diagScore().top || {}).b || null;
    const sv = l.querySelector('[data-save]');
    if (sv) sv.onclick = () => {
      const b = cur(); if (!b) return;
      saveDiagRec(b);
      adoptBundle(b);
      track('diag_adopt', { b: b.id });
      toast(`已采纳「${b.name}」：壳 + 电已同步到「我的组合」，月成本 ¥${b.monthlyCost}`);
      sv.textContent = '已采纳 ✓'; sv.disabled = true;
    };
    const gp = l.querySelector('[data-goplan]');
    if (gp) gp.onclick = () => {
      const b = cur(); if (!b) return;
      saveDiagRec(b);
      setPlanTarget(b.id);
      track('diag_goplan', { b: b.id });
      location.hash = '#plan';
    };
    const ex = l.querySelector('[data-export]');
    if (ex) ex.onclick = () => {
      const b = cur(); if (!b) return;
      copyText(planMarkdown(b), '方案书已复制为 Markdown，可直接贴进审批邮件');
      track('diag_export', { b: b.id });
    };
    const rd = l.querySelector('[data-redo]');
    if (rd) rd.onclick = () => { diagReset(); diagHtml(); track('diag_redo'); };
    l.scrollTop = l.scrollHeight;
  }

  function diagAnswer(v, reduce) {
    const q = DIAG_QS[diag.step]; if (!q || diag.done) return;
    diag.ans[q.k] = v;
    track('diag_answer', { k: q.k, v });
    diag.step++;
    if (diag.step >= DIAG_QS.length) {
      diag.phase = 'gen'; diagHtml();
      setTimeout(() => {
        diag.done = true; diag.phase = 'ask';
        const top = diagScore().top;
        track('diag_done', { b: top && top.b ? top.b.id : '' });
        if (state.view === 'home') diagHtml();
      }, reduce ? 0 : 1150);
    } else {
      diag.phase = 'think'; diagHtml();
      setTimeout(() => { diag.phase = 'ask'; if (state.view === 'home') diagHtml(); }, reduce ? 0 : 480);
    }
  }

  /* ---------- 采纳闭环：壳和电一起落进「我的组合」，不再只塞壳 ---------- */
  function adoptBundle(b) {
    if (!b) return;
    if (state.pickedTools.indexOf(b.tool) < 0) state.pickedTools.push(b.tool);
    if (b.plan) state.pickedPlans = [b.plan];
    try {
      localStorage.setItem('ats_stack', JSON.stringify(state.pickedTools));
      localStorage.setItem('ats_picked', JSON.stringify(state.pickedPlans));
    } catch (e) {}
  }
  function saveDiagRec(b) {
    if (!b) return;
    try {
      const arr = JSON.parse(localStorage.getItem('ats_diag') || '[]');
      arr.push({
        bId: b.id,
        q: {
          goal: (diagOpt('goal', diag.ans.goal) || {}).n || '',
          budget: (diagOpt('budget', diag.ans.budget) || {}).n || '',
          cstr: (diagOpt('cstr', diag.ans.cstr) || {}).n || ''
        },
        t: Date.now()
      });
      while (arr.length > 10) arr.shift();
      localStorage.setItem('ats_diag', JSON.stringify(arr));
    } catch (e) {}
  }
  function setPlanTarget(id) {
    try { localStorage.setItem('ats_plan', id); } catch (e) {}
  }
  function planTarget() {
    let id = '';
    try { id = localStorage.getItem('ats_plan') || ''; } catch (e) {}
    let b = id ? BUNDLES.find(x => x.id === id) : null;
    if (!b) {
      let rs = [];
      try { rs = JSON.parse(localStorage.getItem('ats_diag') || '[]'); } catch (e) {}
      const last = rs[rs.length - 1];
      if (last) b = BUNDLES.find(x => x.id === last.bId) || null;
    }
    return b || null;
  }
  /* 复制：file:// 下 navigator.clipboard 常被拒，textarea + execCommand 兜底 */
  function copyText(text, okMsg) {
    const done = () => toast(okMsg || '已复制');
    const fallback = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta); done();
      } catch (e) { toast('复制失败，请手动选中文本'); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else fallback();
  }

  /* ---------- 方案书（Markdown）：直接贴进审批邮件 ---------- */
  function planMarkdown(b) {
    const plan = PLANS.find(p => p.id === b.plan) || null;
    const tool = TOOLS.find(t => t.id === b.tool) || null;
    const q = quotaVerdict(b.plan);
    const L = [];
    L.push(`# AI 测试工具选型方案：${b.name}`);
    L.push('');
    L.push(`> 生成于 ${new Date().toLocaleDateString('zh-CN')} · 数据核验日 ${META.lastVerified || '—'} · 来源 AI Test Stack`);
    L.push(`> ${META.disclaimer || ''}`);
    L.push('');
    L.push('## 一、结论');
    L.push('');
    L.push(`- 方案：**${b.name}**（${b.title || ''}）`);
    L.push(`- 壳：${b.toolName || (tool && tool.name) || '—'}（${tool ? tool.license : '—'}，${shellCost(tool) ? '¥' + shellCost(tool) + '/月' : '免费，成本在电上'}）`);
    L.push(`- 电：${b.planName || (plan && plan.name) || '—'}（¥${plan ? plan.price : b.monthlyCost}/月${plan && plan.priceNote ? '，' + plan.priceNote : ''}）`);
    L.push(`- 月成本：**¥${b.monthlyCost}/月**（${b.costBasis || ''}）`);
    if (q) L.push(`- 额度：${q.v} —— ${q.note}`);
    L.push('');
    L.push('## 二、为什么是它');
    L.push('');
    (b.why || []).forEach((x, i) => L.push(`${i + 1}. ${x}`));
    L.push('');
    L.push(`适配场景：${b.fit || '—'}`);
    L.push('');
    L.push('## 三、风险与坑位');
    L.push('');
    L.push(`- ${b.watch || '暂无特别标注'}`);
    (PP.guards || []).forEach(g => L.push(`- ${g.t}：${g.d}`));
    L.push('');
    L.push('## 四、落地动作（4 周）');
    L.push('');
    (PP.meta.weeks || []).forEach(w => {
      L.push(`### 第 ${w.n} 周 · ${w.name}`);
      L.push('');
      L.push(`> 本周目标：${w.goal}`);
      L.push('');
      PP.tasks.filter(t => t.w === w.n).forEach(t => {
        L.push(`- [ ] **${t.t}**（约 ${t.min} 分钟）`);
        L.push(`      ${t.d}`);
        L.push(`      验收：${t.acc}`);
      });
      L.push('');
    });
    L.push('## 五、附：接入骨架');
    L.push('');
    L.push('```yaml');
    L.push(planSnippet(b));
    L.push('```');
    L.push('');
    L.push('---');
    L.push('价格与结论均可在站内「数据源与口径」回溯到出处；下单前请以官网现价为准。');
    return L.join('\n');
  }

  /* ---------- 接入骨架：按壳的 CLI 名生成，不假装每家都一样 ---------- */
  function planSnippet(b) {
    const plan = PLANS.find(p => p.id === b.plan) || null;
    const cmd = (PP.cmd || {})[b.tool] || 'your-agent';
    const base = plan && plan.baseUrl ? plan.baseUrl : 'https://<你的-Base-URL>';
    return [
      '# 只在回归失败时调模型：省钱，也不阻塞主流程',
      'name: ai-triage',
      'on:',
      '  workflow_run:',
      '    workflows: ["regression"]',
      '    types: [completed]',
      'jobs:',
      '  triage:',
      '    if: ${{ github.event.workflow_run.conclusion == \'failure\' }}',
      '    runs-on: ubuntu-latest',
      '    steps:',
      '      - uses: actions/checkout@v4',
      '      - name: 复现失败用例并留日志',
      '        run: pytest --lf -q > fail.log || true',
      '      - name: AI 失败归因（只读，不改代码）',
      '        env:',
      '          BASE_URL: ' + base,
      '          API_KEY: ${{ secrets.AI_KEY }}',
      '        run: |',
      '          ' + cmd + ' "读 fail.log，按根因分组，给出最小复现步骤；' +
        '没有证据就回答无法判断" \\',
      '            --base-url "$BASE_URL"'
    ].join('\n');
  }

  /* ---------- 执行包页 ---------- */
  function planProg(bid) {
    try {
      const all = JSON.parse(localStorage.getItem('ats_planprog') || '{}');
      return Array.isArray(all[bid]) ? all[bid] : [];
    } catch (e) { return []; }
  }
  function setPlanProg(bid, arr) {
    try {
      const all = JSON.parse(localStorage.getItem('ats_planprog') || '{}');
      all[bid] = arr;
      localStorage.setItem('ats_planprog', JSON.stringify(all));
    } catch (e) {}
  }

  function renderPlan() {
    const b = planTarget();
    const empty = $('#ppEmpty'), grid = $('#ppGrid'), sum = $('#ppSum'), lead = $('#ppLead');
    const rail = $('#ppRail'), days = $('#ppDays');
    if (!empty || !grid) return;

    if (days) days.innerHTML = '30<small> 天</small>';
    if (rail) rail.innerHTML = `4 周 · ${(PP.tasks || []).length} 个动作<br>每个动作都有验收标准`;
    if (lead) lead.textContent = (PP.meta && PP.meta.lead) || '';

    if (!b) {
      grid.hidden = true;
      empty.hidden = false;
      empty.innerHTML = `
        <div class="ppEmptyCard">
          <div class="pk">NO PLAN YET</div>
          <h2>还没有选定方案</h2>
          <p>执行包是从一套具体的「壳 + 电」长出来的：动作表里的每一步都要指向真实的 Base URL、真实的额度和真实的价格。所以先定方案，再来这里。</p>
          <div class="gchips">
            <a class="btn primary" href="#home">去首页做三问诊断 →</a>
            <a class="btn" href="#bundles">直接挑一套组合</a>
          </div>
        </div>`;
      if (sum) sum.innerHTML = '';
      return;
    }

    empty.hidden = true;
    grid.hidden = false;

    const plan = PLANS.find(p => p.id === b.plan) || null;
    const tool = TOOLS.find(t => t.id === b.tool) || null;
    const q = quotaVerdict(b.plan);
    const budgetCap = diag.ans.budget && diag.ans.budget !== 'any' ? +diag.ans.budget : null;
    const left = budgetCap != null ? Math.max(0, budgetCap - b.monthlyCost) : null;

    if (sum) sum.innerHTML = `
      <div><small>当前方案</small><b>${esc(b.name)}</b><em>壳：${esc(tool ? tool.name : '—')} · 电：${esc(plan ? plan.name + ' ' + (plan.tier || '') : b.planName || '—')}</em></div>
      <div><small>月成本</small><div class="mono">¥${b.monthlyCost}</div><em>${esc(plan && plan.priceNote ? plan.priceNote : b.costBasis || '')}</em></div>
      <div><small>${left != null ? '预算余量' : '额度判断'}</small><div class="mono">${left != null ? '¥' + left : esc(q ? q.v : '—')}</div><em>${left != null ? (q ? '额度' + q.v : '按预算上限算') : '无预算上限'}</em></div>`;

    // ---- 周次与动作 ----
    const prog = planProg(b.id);
    const body = $('#ppBody');
    if (body) {
      body.innerHTML = (PP.meta.weeks || []).map(w => {
        const tasks = (PP.tasks || []).filter(t => t.w === w.n);
        const mins = tasks.reduce((a, t) => a + (t.min || 0), 0);
        return `
          <div class="week">
            <div class="wkHead"><i>WEEK 0${w.n}</i><b>${esc(w.name)}</b><span>≈ ${(mins / 60).toFixed(1)} 小时</span></div>
            <div class="wkGoal">本周目标：${esc(w.goal)}</div>
            ${tasks.map(t => {
              const on = prog.indexOf(t.id) >= 0;
              return `<div class="task${on ? ' done' : ''}" data-task="${esc(t.id)}">
                <span class="tick${on ? ' on' : ''}" role="checkbox" aria-checked="${on}" tabindex="0" aria-label="${esc(t.t)}">✓</span>
                <div><b>${esc(t.t)}</b><p>${esc(t.d)}</p><div class="acc">验收：<em>${esc(t.acc)}</em></div></div>
                <div class="hrs">${t.min} min</div>
              </div>`;
            }).join('')}
          </div>`;
      }).join('') + `
        <div class="ppCode">
          <div class="ch"><span>接入骨架 · .github/workflows/ai-triage.yml</span><button type="button" class="chCopy" data-copycode>复制</button></div>
          <pre>${esc(planSnippet(b))}</pre>
        </div>`;
    }

    // ---- 右栏 ----
    const side = $('#ppSide');
    const doneN = prog.length, totalN = (PP.tasks || []).length;
    const pct = totalN ? Math.round(doneN / totalN * 100) : 0;
    const leftMin = (PP.tasks || []).filter(t => prog.indexOf(t.id) < 0).reduce((a, t) => a + (t.min || 0), 0);
    if (side) side.innerHTML = `
      <div class="prog">
        <h4>进度</h4>
        <b>${doneN}<small> / ${totalN} 完成</small></b>
        <div class="pbar"><i style="width:${pct}%"></i></div>
        <div class="pgNote">${doneN === totalN ? '全部完成。下一步：按第 4 周的动作核一次现价再决定续费。' : `还剩 ${totalN - doneN} 个动作，约 ${(leftMin / 60).toFixed(1)} 小时。进度存在本机，不上传。`}</div>
      </div>
      ${b.watch ? `<div class="riskbox"><b>! 这套方案最容易翻车的地方</b><p>${esc(b.watch)}</p></div>` : ''}
      <h4>三条禁区</h4>
      <ul class="guards">${(PP.guards || []).map(g => `<li><b>${esc(g.t)}</b><span>${esc(g.d)}</span></li>`).join('')}</ul>
      <h4>带走</h4>
      <div class="exp">
        <button type="button" class="btn primary" data-expmd>导出 Markdown 方案书</button>
        <button type="button" class="btn" data-copysum>复制给领导的摘要</button>
        <button type="button" class="btn" data-resetprog>清空勾选</button>
        <a class="btn" href="#bundles">换一套方案</a>
      </div>
      <div class="sideNote">
        <h4>两个月后回来一次</h4>
        <p>价格会变——这个市场有过 24 天涨 140% 的记录。执行包做完时，回「市场变动」核一次价，别按旧价续费。</p>
        <a class="btn" href="#events">看价格轨迹 →</a>
      </div>`;

    // ---- 交互 ----
    $$('#ppBody .task').forEach(el => {
      const toggleTask = () => {
        const id = el.dataset.task;
        const cur = planProg(b.id);
        const i = cur.indexOf(id);
        if (i >= 0) cur.splice(i, 1); else cur.push(id);
        setPlanProg(b.id, cur);
        track('plan_tick', { b: b.id, t: id, on: i < 0 });
        renderPlan();
      };
      el.onclick = toggleTask;
      el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleTask(); } };
    });
    const cc = $('#ppBody [data-copycode]');
    if (cc) cc.onclick = () => copyText(planSnippet(b), '接入骨架已复制，粘到 .github/workflows/ 下即可');
    const em = $('#ppSide [data-expmd]');
    if (em) em.onclick = () => { downloadText('AI测试选型方案-' + b.id + '.md', planMarkdown(b)); track('plan_export', { b: b.id }); };
    const cs = $('#ppSide [data-copysum]');
    if (cs) cs.onclick = () => { copyText(planSummary(b), '摘要已复制，可直接贴进邮件或群聊'); track('plan_copy', { b: b.id }); };
    const rp = $('#ppSide [data-resetprog]');
    if (rp) rp.onclick = () => { setPlanProg(b.id, []); toast('勾选已清空'); renderPlan(); };
  }

  /* 给领导看的三行：结论 / 钱 / 风险。不要技术细节。 */
  function planSummary(b) {
    const plan = PLANS.find(p => p.id === b.plan) || null;
    const q = quotaVerdict(b.plan);
    return [
      `结论：建议采用「${b.name}」作为团队 AI 测试工具组合。`,
      `成本：¥${b.monthlyCost}/月${plan && plan.priceNote ? '（' + plan.priceNote + '，次月起按标准价）' : ''}，壳免费，钱全花在模型额度上。`,
      `能力：${b.summary || ''}`,
      `风险：${b.watch || '无特别标注'}${q ? `；额度${q.v}（${q.note}）` : ''}`,
      `落地：4 周 ${(PP.tasks || []).length} 个动作，第一周只做接通与兜底，第 2 周才进流水线。`,
      `出处：AI Test Stack · 数据核验日 ${META.lastVerified || '—'}`
    ].join('\n');
  }

  function downloadText(name, text) {
    try {
      const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
      toast('已导出 ' + name);
    } catch (e) { copyText(text, '浏览器不允许下载，已复制到剪贴板'); }
  }

  /* 我的组合 · 诊断记录：采纳 = 壳 + 电一起进组合计算 */
  function renderDiagRecs() {
    const el = $('#stackDiag'); if (!el) return;
    let rs = [];
    try { rs = JSON.parse(localStorage.getItem('ats_diag') || '[]'); } catch (e) {}
    if (!rs.length) { el.innerHTML = '<div class="empty">还没有诊断记录。回<a href="#home">首页诊断台</a>跑一次，3 个问题出一份组合方案。</div>'; return; }
    el.innerHTML = rs.slice(-3).reverse().map(r => {
      const b = BUNDLES.find(x => x.id === r.bId); if (!b) return '';
      const d = new Date(r.t);
      return `<div class="drec"><span class="drcDot" aria-hidden="true"></span>
        <span class="drcMain"><b>${esc(b.name)}</b><small>${esc([r.q.goal, r.q.cstr].filter(Boolean).join(' · '))} · ¥${b.monthlyCost}/月 · ${d.getMonth() + 1}-${d.getDate()}</small></span>
        <button type="button" class="btn sm" data-goplan2="${esc(b.id)}">执行包</button>
        <button type="button" class="btn sm" data-adopt="${esc(b.id)}">采纳</button></div>`;
    }).join('');
    $$('#stackDiag [data-adopt]').forEach(btn => btn.onclick = () => {
      const b = BUNDLES.find(x => x.id === btn.dataset.adopt); if (!b) return;
      adoptBundle(b);
      toast(`已采纳「${b.name}」：壳 + 电已同步到下方组合，月成本 ¥${b.monthlyCost}`);
      track('diag_adopt', { b: b.id });
      renderStack();
      renderCalc();
    });
    $$('#stackDiag [data-goplan2]').forEach(btn => btn.onclick = () => {
      setPlanTarget(btn.dataset.goplan2);
      track('plan_open', { b: btn.dataset.goplan2 });
      location.hash = '#plan';
    });
  }

  function renderHome() {
    const ms = $('#homeMods');
    if (ms) ms.innerHTML = IA.filter(p => p.id !== 'home').map((p, i) => `
      <a class="mcard" href="#${p.id}">
        <div class="mh"><span class="mic" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span class="mn">${esc(p.name)}</span></div>
        <p class="mtg">${esc(p.tag)}</p>
        <span class="mgo">进入${esc(p.name)} →</span>
      </a>`).join('');
    // 读数条：数字全部来自数据文件，不做假数
    [['rdTools', TOOLS.length], ['rdPlans', PLANS.length], ['rdBundles', BUNDLES.length], ['rdCaps', CAP_LIST.length]]
      .forEach(([id, n]) => { const el = document.getElementById(id); if (el) el.dataset.n = n; });
    const hv = $('#hVerify'); if (hv) hv.textContent = META.lastVerified || '—';
    const hc = $('#hCounts'); if (hc) hc.textContent = `${TOOLS.length} 工具 · ${PLANS.length} 档套餐 · ${BUNDLES.length} 套组合`;
    countUp();
    startHeroRot();
    diagHtml();
  }

  function render404() {
    const b = $('#nfLinks');
    if (!b || b.dataset.done) return;
    b.dataset.done = '1';
    // 404 要把全部入口摆出来，包括新加的站务页——死路上至少能看见所有岔口
    b.innerHTML = FEATURE_VIEWS.map(v => `<a class="gchip" href="#${v}">${esc(VIEW_NAME[v] || v)}</a>`).join('')
      + SITE_PAGES.map(v => `<a class="gchip" href="#${v}">⌘ ${esc(VIEW_NAME[v] || v)}</a>`).join('');
  }

  /* =========================================================
     站务层：关于 / 帮助 / 隐私 / 联系 / 搜索 / 个人中心 / 反馈 / 出错兜底
     ---------------------------------------------------------
     这几页服务「站」本身，不属于任何内容模块。文案全部来自 data/pages.json，
     逻辑集中在这里——加一个静态页只需要改 JSON + 一个 <section>，不用碰模块体系。
     ========================================================= */

  /* ---------- 文案里的可点标记 ----------
     写法 `{feedback}` 会在渲染时换成当前环境真实的链接（有仓库就指 issue，没有就指站内页）。
     先 esc 再替换，所以配置里写不了内联 HTML——这是有意的：文案不该能带脚本。 */
  function linkTokens() {
    return {
      repo: { h: SITE.repoUrl || '', n: '公开仓库' },
      issue: { h: SITE.issue || '#feedback', n: '开一条 Issue' },
      feedback: { h: '#feedback', n: '反馈页' },
      contact: { h: '#contact', n: '联系方式' },
      search: { h: '#search', n: '全站搜索' },
      mine: { h: '#mine', n: '个人中心' },
      home: { h: '#home', n: '首页诊断台' },
      all: { h: '#plans', n: '价格页' },
      map: { h: '#home', n: '首页' },
      src: { h: '#data?sec=sources', n: '数据源与口径' },
      health: { h: '#data?sec=health', n: '数据健康' },
      chg: { h: '#data?sec=changelog', n: '更新日志' },
      stack: { h: '#stacks?sec=stack', n: '我的组合' },
      plan: { h: '#stacks?sec=plan', n: '落地执行包' },
      report: { h: '#stacks?sec=report', n: '决策报告' },
      persona: { h: '#career?sec=persona', n: '测试人自测' },
      roles: { h: '#career?sec=roles', n: '角色阶梯' },
      evalset: { h: '#library?sec=evalset', n: 'AI 评测集' },
      plans: { h: '#plans', n: '套餐对比' },
      news: { h: '#signal?sec=news', n: 'AI 大事' },
      privacy: { h: '#privacy', n: '隐私与条款' }
    };
  }
  function inlineLinks(s) {
    const T = linkTokens();
    let h = esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
    /* 计数占位符先替换：`{count:plans}` 带冒号，后面的链接占位符正则匹配不到它 */
    h = h.replace(/\{count:([a-z]+)\}/g, (m, k) => (COUNTS[k] == null ? m : String(COUNTS[k])));
    return h.replace(/\{([a-z]+)\}/g, (m, k) => {
      const t = T[k];
      if (!t || !t.h) return m;
      const ext = /^https?:/.test(t.h) ? ' target="_blank" rel="noopener"' : '';
      return `<a href="${esc(t.h)}"${ext}>${esc(t.n)}</a>`;
    });
  }

  function pageBlocks(blocks) {
    return (blocks || []).map(b => {
      if (b.t === 'h') return `<h3 class="pgH">${inlineLinks(b.x)}</h3>`;
      if (b.t === 'p') return `<p class="pgP">${inlineLinks(b.x)}</p>`;
      if (b.t === 'note') {
        const tone = b.tone === 'warn' ? 'warn' : b.tone === 'bad' ? 'bad' : 'good';
        return `<div class="note ${tone}">${inlineLinks(b.x)}</div>`;
      }
      if (b.t === 'ul') return `<ul class="ul${b.tone === 'bad' ? ' bad' : ''}">${(b.items || []).map(x => `<li>${inlineLinks(x)}</li>`).join('')}</ul>`;
      if (b.t === 'dl') return `<dl class="pgDL">${(b.items || []).map(p => `<dt>${inlineLinks(p[0])}</dt><dd>${inlineLinks(p[1])}</dd>`).join('')}</dl>`;
      if (b.t === 'kv') return `<div class="kvList">${(b.items || []).map(p => `<div class="kv"><b>${esc(p[0])}</b><span>${inlineLinks(p[1])}</span></div>`).join('')}</div>`;
      if (b.t === 'faq') return `<div class="faqList">${(b.items || []).map((p, i) => `<details class="faq"${i === 0 ? ' open' : ''}><summary>${inlineLinks(p[0])}</summary><div class="faqA">${inlineLinks(p[1])}</div></details>`).join('')}</div>`;
      return '';
    }).join('');
  }

  function backRow() {
    return `<div class="panel pback">
      <div class="gk">继续</div>
      <div class="gchips">
        <a class="gchip" href="#home">← 首页</a>
        <a class="gchip" href="#tools">工具</a>
        <a class="gchip" href="#search">⌕ 搜索</a>
        <a class="gchip" href="#mine">◍ 个人中心</a>
      </div>
    </div>`;
  }

  function renderStaticPage(key) {
    const pg = PAGES[key];
    const head = document.getElementById(key + 'Head');
    const body = document.getElementById(key + 'Body');
    if (!head || !body) return;
    if (!pg) {
      head.innerHTML = `<div class="kick">Missing</div><h1>内容缺失</h1><p>data/pages.json 里没有 <code>${esc(key)}</code>。构建期本该拦下这种问题。</p>`;
      body.innerHTML = backRow();
      return;
    }
    head.innerHTML = `<div class="kick">${esc(pg.kick)}</div><h1>${esc(pg.title)}</h1><p>${inlineLinks(pg.lede)}</p>`
      + (pg.lede2 ? `<p class="mini">${inlineLinks(pg.lede2)}</p>` : '');
    body.innerHTML = `<div class="panel pagePanel">${pageBlocks(pg.blocks)}</div>`
      + `<div class="panel"><h3><span class="ic">✉</span>这一页有错、或者没讲清？</h3>
        <div class="sub">直接说，比猜有用。反馈会落到公开仓库，留得下记录。</div>
        <div class="gchips"><a class="btn primary" href="#feedback">去反馈 →</a><a class="btn" href="#contact">其他联系方式</a></div></div>`
      + backRow();
  }

  /* ---------- 全站搜索 ----------
     索引在第一次进搜索页时构一次（约 400 条），之后只做过滤。
     不预建在 init 里：首页不需要它，没必要为一次搜索拖慢首屏。 */
  const SEARCH_KIND = { feat: '功能', tool: '工具', plan: '套餐', bundle: '组合', news: '大事', cap: '能力', src: '来源', page: '站务', community: '资源' };
  let SIDX = null;
  function searchIndex() {
    if (SIDX) return SIDX;
    const out = [];
    // 页面和页内章节都进索引：搜「决策矩阵」要能直接落到 工具 → 决策矩阵 那一块
    IA.forEach(p => {
      out.push({ k: 'page', id: 'p:' + p.id, n: p.name, d: p.tag || '', go: '#' + p.id, tag: '页面' });
      (p.secs || []).forEach(([s, label]) =>
        out.push({ k: 'feat', id: s, n: label, d: '', go: '#' + p.id + '?sec=' + s, tag: p.name }));
    });
    SITE_PAGES.forEach(v => out.push({ k: 'page', id: v, n: VIEW_NAME[v] || v, d: (PAGES[v] && PAGES[v].lede) || '', go: '#' + v, tag: '站务' }));
    TOOLS.forEach(t => out.push({ k: 'tool', id: t.id, n: t.name, d: (t.tagline || '') + ' · ' + (t.vendor || ''), go: '#tools', tag: t.kind === 'qa' ? 'AI 测试平台' : '编程外壳' }));
    PLANS.forEach(p => out.push({ k: 'plan', id: p.id, n: p.name + ' · ' + (p.tier || ''), d: (p.vendor || '') + ' · ' + (p.currency === 'USD' ? '$' : '¥') + p.price, go: '#plans', tag: p.region === 'cn' ? '国内' : '国际' }));
    BUNDLES.forEach(b => out.push({ k: 'bundle', id: b.id, n: b.name, d: b.summary || '', go: '#bundles', tag: '¥' + b.monthlyCost + '/月' }));
    (NEWS.events || []).forEach(e => out.push({ k: 'news', id: e.id, n: e.title || '', d: (e.impact || e.body || '').slice(0, 110), go: '#news', tag: e.date || '' }));
    CAP_LIST.forEach(c => out.push({ k: 'cap', id: c.id, n: c.name, d: c.desc || '', go: '#capabilities', tag: c.groupName || '' }));
    (SRC.groups || []).forEach(g => (g.items || []).forEach((s, i) => out.push({ k: 'src', id: g.id + ':' + i, n: s.n || '', d: s.d || '', go: '#sources', tag: g.name || '' })));
    (CM.items || []).forEach(c => out.push({
      k: 'community', id: c.id, n: c.name,
      d: (c.what || '') + ' · ' + (c.use || ''),
      go: '#community', tag: (CM_CAT[c.cat] || {}).name || c.cat
    }));
    SIDX = out;
    return out;
  }

  const SQ = { q: '', cat: 'all' };

  function searchHits() {
    const q = SQ.q.trim().toLowerCase();
    let list = searchIndex().filter(x => SQ.cat === 'all' || x.k === SQ.cat);
    if (q) {
      const terms = q.split(/\s+/).filter(Boolean);
      list = list.filter(x => {
        const hay = (x.n + ' ' + x.d + ' ' + x.tag + ' ' + x.id).toLowerCase();
        return terms.every(t => hay.indexOf(t) >= 0);
      });
      // 名称命中排前面：搜「价格」时，"价格"叫这个名字的条目比正文提到它的更相关
      list = list.map(x => {
        const n = (x.n || '').toLowerCase();
        const score = n.indexOf(q) === 0 ? 3 : n.indexOf(q) >= 0 ? 2 : 1;
        return { x, score };
      }).sort((a, b) => b.score - a.score).map(o => o.x);
    }
    return list;
  }

  function sresRow(x) {
    if (x.k === 'tool') {
      return `<button class="sresRow" type="button" data-tool-open="${esc(x.id)}">
        <span class="srk">工具</span><b>${esc(x.n)}</b><span class="srd">${esc(x.d)}</span><i aria-hidden="true">打开 →</i></button>`;
    }
    return `<a class="sresRow" href="${esc(x.go)}">
      <span class="srk">${esc(SEARCH_KIND[x.k] || x.k)}</span><b>${esc(x.n)}</b><span class="srd">${esc(x.d)}</span><i aria-hidden="true">→</i></a>`;
  }

  function renderSearch() {
    const cats = $('#siteQCats'), meta = $('#siteQMeta'), body = $('#siteQBody');
    if (!cats || !body) return;
    const allHint = $('#searchAllHint');
    if (allHint) allHint.textContent = `${FEATURE_VIEWS.length} 个功能页平铺成一张规格表`;
    cats.innerHTML = [{ k: 'all', n: '全部' }].concat(Object.keys(SEARCH_KIND).map(k => ({ k, n: SEARCH_KIND[k] })))
      .map(c => `<button class="chip${SQ.cat === c.k ? ' on' : ''}" type="button" data-sq="${c.k}" aria-pressed="${SQ.cat === c.k}">${c.n}</button>`).join('');

    const all = searchIndex();
    const hits = searchHits();
    const q = SQ.q.trim();
    if (meta) {
      meta.innerHTML = q
        ? `「<b>${esc(q)}</b>」命中 <b>${hits.length}</b> 条${SQ.cat === 'all' ? '' : '（限定：' + SEARCH_KIND[SQ.cat] + '）'}`
        : `索引里共 <b>${all.length}</b> 条：功能页、工具、套餐、组合、大事、能力、来源、站务页。输入关键词开始筛。`;
    }

    if (!hits.length) {
      body.innerHTML = `<div class="empty">${
        q ? `没有命中「${esc(q)}」。换个说法试试：价格 / 诊断 / 国内直连 / 组合` : '这个分类下还没有条目'
      }</div>`;
      return;
    }

    // 分组：不限分类时按类型分块，同类型排在一起；每类最多 8 条，避免一屏 200 行
    const groups = {};
    hits.forEach(x => { (groups[x.k] = groups[x.k] || []).push(x); });
    const order = Object.keys(SEARCH_KIND).filter(k => groups[k]);
    body.innerHTML = order.map(k => {
      const list = groups[k];
      const cap = (SQ.more && SQ.more[k]) ? 80 : (q ? 8 : 5);
      const shown = list.slice(0, cap);
      const more = list.length - shown.length;
      return `<div class="panel sresGrp">
        <div class="sgHead"><b>${SEARCH_KIND[k]}</b><span>${list.length} 条</span></div>
        ${shown.map(sresRow).join('')}
        ${more > 0 ? `<button class="chip chMore" type="button" data-sq-more="${k}">还有 ${more} 条</button>` : ''}
      </div>`;
    }).join('');
  }

  /* ---------- 我的 ---------- */
  function planCost() {
    let c = 0;
    (state.pickedPlans || []).forEach(id => {
      const p = PLANS.find(x => x.id === id);
      if (!p) return;
      c += p.currency === 'USD' ? (p.price || 0) * 7.25 : (p.price || 0);
    });
    return Math.round(c);
  }

  function renderMine() {
    const g = $('#mineGrid');
    if (!g) return;
    const meta = $('#mineMeta');
    const diag = lsGet(LS.diag, []) || [];
    const stack = state.pickedTools || [];
    const plans = state.pickedPlans || [];

    if (meta) meta.textContent = `收藏 ${FAV.length} 项 · 浏览记录 ${RECENT.length} 条 · 诊断 ${diag.length} 次`;

    const favList = FAV.length
      ? FAV.map(f => `<div class="mrow">
          <a class="mgo2" href="${esc(f.go || '#home')}"><b>${esc(f.n)}</b><span>${esc(f.k === 'tool' ? '工具' : f.k === 'plan' ? '套餐' : f.k === 'bundle' ? '组合' : f.k === 'community' ? '资源' : '页面')}</span></a>
          <button class="mx" type="button" data-mfav="${esc(f.k)}" data-fav-id="${esc(f.id)}" aria-label="取消收藏 ${esc(f.n)}">×</button>
        </div>`).join('')
      : '<div class="empty">还没有收藏。工具卡、组合卡、功能页底部都有 ☆，点一下就在这里。</div>';

    const recList = RECENT.length
      ? RECENT.slice(0, 12).map(r => {
          const name = VIEW_NAME[r.v] || r.v;
          return `<a class="mrow mrec" href="#${esc(r.v)}"><b>${esc(name)}</b><span>${ago(r.t)}</span></a>`;
        }).join('')
      : '<div class="empty">还没有浏览记录。这一栏只在你的浏览器里，不会上传。</div>';

    const stackHtml = (stack.length || plans.length)
      ? `<div class="mstat"><b>${stack.length}</b><span>个壳</span><b>${plans.length}</b><span>档套餐</span><b>¥${planCost()}</b><span>/ 月</span></div>
         <div class="mnames">${stack.map(id => (TOOLS.find(t => t.id === id) || {}).name || id).concat(plans.map(id => (PLANS.find(p => p.id === id) || {}).name || id)).map(n => `<span class="tag c">${esc(n)}</span>`).join('')}</div>
         <a class="btn sm" href="#stack">打开我的组合 →</a>`
      : '<div class="empty">还没选组合。去<a href="#bundles">组合方案</a>照抄一套，或回<a href="#home">首页诊断台</a>让引擎给你一套。</div>';

    const diagHtml = diag.length
      ? diag.slice().reverse().slice(0, 5).map(d => {
          const b = BUNDLES.find(x => x.id === d.bId) || {};
          return `<div class="mrow"><a class="mgo2" href="#plan"><b>${esc(b.name || d.bId || '方案')}</b><span>${esc([d.q && d.q.goal, d.q && d.q.budget, d.q && d.q.cstr].filter(Boolean).join(' · '))}</span></a><span class="mt">${ago(d.t)}</span></div>`;
        }).join('')
      : '<div class="empty">还没有诊断记录。回<a href="#home">首页诊断台</a>跑一次，3 个问题出一份组合方案。</div>';

    g.innerHTML = `
      <div class="mcard2"><div class="mc2h"><b>我的收藏</b><span>${FAV.length}</span></div><div class="mc2b">${favList}</div></div>
      <div class="mcard2"><div class="mc2h"><b>最近浏览</b><span>${RECENT.length}</span></div><div class="mc2b">${recList}</div></div>
      <div class="mcard2"><div class="mc2h"><b>我的组合</b><span>${stack.length + plans.length}</span></div><div class="mc2b">${stackHtml}</div></div>
      <div class="mcard2"><div class="mc2h"><b>诊断记录</b><span>${diag.length}</span></div><div class="mc2b">${diagHtml}</div></div>`;

    const acts = $('#mineActions');
    if (acts) acts.innerHTML = `
      <button class="btn" type="button" id="mineExport">⇩ 导出我的数据（JSON）</button>
      <a class="btn" href="#report">▥ 生成决策报告</a>
      <button class="btn danger" type="button" id="mineClear">清空本机数据</button>`;

    const store = $('#mineStore');
    if (store) {
      const keys = [
        [LS.theme, '主题偏好'], [LS.fav, '收藏'], [LS.recent, '浏览历史'],
        [LS.stack, '勾选的工具壳'], [LS.picked, '勾选的套餐'], [LS.diag, '诊断记录'],
        [LS.events, '匿名使用路径'], [LS.plan, '当前执行包'], [LS.planprog, '执行包进度']
      ];
      store.innerHTML = keys.map(([k, label]) => {
        let v = null;
        try { v = localStorage.getItem(k); } catch (e) { v = null; }
        const size = v == null ? '—' : (v.length > 120 ? v.slice(0, 120) + '…' : v);
        return `<div class="kv"><b>${esc(k)}</b><span class="kvlab">${esc(label)}</span><code>${esc(size)}</code></div>`;
      }).join('');
    }
  }

  function ago(t) {
    if (!t) return '';
    const d = Date.now() - t;
    if (d < 6e4) return '刚刚';
    if (d < 36e5) return Math.round(d / 6e4) + ' 分钟前';
    if (d < 864e5) return Math.round(d / 36e5) + ' 小时前';
    if (d < 2592e6) return Math.round(d / 864e5) + ' 天前';
    return new Date(t).toISOString().slice(0, 10);
  }

  /* ---------- 反馈 ----------
     四类反馈共用一套表单：类型决定标题前缀、模板正文和落到哪个 Issue 模板。
     GitHub 的 issue 表单只支持预填 title/labels/assignees/milestone，不支持 body，
     所以正文一律「复制到剪贴板 + 让用户粘贴」——这是平台限制，不是偷懒。 */
  const FB_KINDS = [
    { k: 'bug', n: '报错', icon: '!', line: '页面坏了、按钮没反应、显示错位', prefix: '[报错] ', tpl: 'feedback.yml', hint: '写清：哪个页面、点了什么、期望什么、实际什么。能截图更好。' },
    { k: 'data', n: '数据纠错', icon: '≠', line: '价格、额度、限制写错了', prefix: '[数据] ', tpl: 'data-correction.yml', hint: '价格类必须给四样：哪一条、现在是什么、应该是什么、官网链接 + 核验日期。' },
    { k: 'idea', n: '建议', icon: '+', line: '缺什么功能、哪里不好用', prefix: '[建议] ', tpl: 'feedback.yml', hint: '说清「你想解决什么问题」，比「加个 XX」有用得多。' },
    { k: 'ask', n: '提问', icon: '?', line: '怎么用、为什么这么判', prefix: '[提问] ', tpl: 'feedback.yml', hint: '先说你在哪一页、想做什么。很多问题在「帮助与说明」里已经有答案。' }
  ];
  /* 反馈表单的当前状态。注意别叫 FB —— 那个名字已经被 freebies 数据占了，
     重名会在整包脚本里直接抛 SyntaxError，整个站白屏（这个错犯过一次）。 */
  const FBST = { kind: 'bug' };

  function fbText() {
    const f = FB_KINDS.find(x => x.k === FBST.kind) || FB_KINDS[0];
    const where = ($('#fbWhere') && $('#fbWhere').value.trim()) || '（未填）';
    const body = ($('#fbText') && $('#fbText').value.trim()) || '（未填）';
    return [
      '### ' + f.n,
      '',
      '**位置**：' + where,
      '',
      '**具体是什么**',
      '',
      body,
      '',
      '---',
      '- 页面：' + (location.hash || '#home'),
      '- 版本：v' + (META.version || '—'),
      '- 数据核验日：' + (META.lastVerified || '—'),
      '- 浏览器：' + (navigator.userAgent || '—').slice(0, 120)
    ].join('\n');
  }

  function fbUrl() {
    const f = FB_KINDS.find(x => x.k === FBST.kind) || FB_KINDS[0];
    if (!SITE.issue) return '';
    const where = ($('#fbWhere') && $('#fbWhere').value.trim()) || '';
    const title = f.prefix + (where || f.n);
    return SITE.issue + '?template=' + encodeURIComponent(f.tpl) + '&title=' + encodeURIComponent(title.slice(0, 120));
  }

  function renderFeedback() {
    const kinds = $('#fbKinds');
    if (kinds) {
      kinds.innerHTML = FB_KINDS.map(f => `<button class="fbk${FBST.kind === f.k ? ' on' : ''}" type="button" data-fb="${f.k}" aria-pressed="${FBST.kind === f.k}">
        <i aria-hidden="true">${f.icon}</i><b>${f.n}</b><span>${f.line}</span></button>`).join('');
    }
    const pg = PAGES.feedback || {};
    const h = $('#fbTitle'), l = $('#fbLede'), l2 = $('#fbLede2');
    if (h && pg.title) h.textContent = pg.title;
    if (l && pg.lede) l.innerHTML = inlineLinks(pg.lede);
    if (l2) l2.innerHTML = pg.lede2 ? inlineLinks(pg.lede2) : '';
    const hint = $('#fbHint');
    const cur = FB_KINDS.find(x => x.k === FBST.kind) || FB_KINDS[0];
    if (hint) hint.textContent = cur.hint;
    // 从某个功能页点「这一页有问题」过来：把页名带进「位置」，只带一次
    if (FBST.prefill) {
      const w = $('#fbWhere');
      if (w && !w.value.trim()) w.value = FBST.prefill;
      FBST.prefill = '';
    }
    const prev = $('#fbPreview');
    if (prev) prev.textContent = fbText();
    const note = $('#fbNote');
    if (note) note.innerHTML = SITE.issue
      ? '会打开 <b>' + esc(cur.tpl) + '</b> 表单，标题已预填。GitHub 不支持预填正文，模板已复制到剪贴板，粘进去即可。'
      : '当前没有关联的公开仓库（本地预览就是这样），所以只会复制模板。发布后会自动指向 issue。';
    renderFbSaved();
  }

  function renderFbSaved() {
    const box = $('#fbSaved');
    if (!box) return;
    const list = lsGet(LS.fb, []) || [];
    if (!list.length) { box.innerHTML = '<div class="empty">本机还没有留档。网络不通时可以先存着，等能开 GitHub 再复制出去。</div>'; return; }
    box.innerHTML = list.map((f, i) => `<div class="fbSavedRow">
      <div class="fsrH"><b>${esc(f.kindName)}</b><span>${ago(f.t)}</span></div>
      <pre class="fsrB">${esc(f.text)}</pre>
      <div class="gchips"><button class="chip" type="button" data-fb-copy="${i}">复制</button><button class="chip" type="button" data-fb-del="${i}">删除</button></div>
    </div>`).join('');
  }

  /* ---------- 出错兜底 ----------
     静态站没有 500，但「某个渲染函数抛异常」同样会让用户看到白屏。
     这里把异常接住，显示一页能自救的东西，并把堆栈摆出来方便开 issue。 */
  /* 出错页的岔口清单。直接访问 #error 时也要有——否则手动进来看到的是一片空 */
  function fillErrLinks() {
    const el = $('#errLinks');
    if (!el || el.dataset.done) return;
    el.dataset.done = '1';
    el.innerHTML = FEATURE_VIEWS.map(v => `<a class="gchip" href="#${v}">${esc(VIEW_NAME[v] || v)}</a>`).join('')
      + SITE_PAGES.map(v => `<a class="gchip" href="#${v}">⌘ ${esc(VIEW_NAME[v] || v)}</a>`).join('');
  }

  function showError(err) {
    const msg = (err && err.message) || String(err || '未知错误');
    const trace = (err && err.stack) || msg;
    state.view = 'error';
    $$('.view').forEach(s => s.classList.toggle('on', s.id === 'v-error'));
    const em = $('#errMsg');
    if (em) em.textContent = '渲染时抛了一个异常：' + msg + '。站点的其他部分不受影响——数据全在本地。';
    const et = $('#errTrace');
    if (et) et.textContent = trace + '\n\nlocation: ' + (location.hash || '#home') + '\nversion: v' + (META.version || '—');
    fillErrLinks();
    const sub = $('#subnav');
    if (sub) { sub.hidden = true; sub.innerHTML = ''; }
    document.title = '页面出错 · AI Test Stack';
    document.documentElement.classList.add('ready');
    try { track('render_error', { m: msg.slice(0, 120), v: location.hash }); } catch (e) {}
  }

  /* ---------- 导航渲染（配置驱动） ---------- */
  function navItemHtml(x) {
    const ext = x.ext ? ' target="_blank" rel="noopener"' : '';
    const href = x.go === 'issue' ? (SITE.repoUrl ? SITE.repoUrl + '/issues/new' : '#feedback') : x.go;
    return `<a href="${esc(href)}"${ext}>${x.icon ? esc(x.icon) + ' ' : ''}${esc(x.n)}</a>`;
  }
  function reservedHtml() {
    return (NAV.reserved || []).map(r =>
      `<span class="ddSoon" title="${esc(r.why || '')}">◌ ${esc(r.n)}<b class="soon">${esc(r.note || '规划中')}</b></span>`).join('');
  }
  function renderNav() {
    const tn = $('#tnav');
    if (tn && NAV.primary && NAV.primary.length) {
      tn.innerHTML = NAV.primary.map(it => {
        if (it.group) {
          return `<span class="tdd">
            <button class="tddBtn" type="button" data-nav="${esc(it.key || '')}" aria-expanded="false" aria-haspopup="true">${esc(it.group)} <i aria-hidden="true">▾</i></button>
            <span class="tddMenu" hidden>${(it.items || []).map(navItemHtml).join('')}${it.key === 'more' ? reservedHtml() : ''}</span>
          </span>`;
        }
        return `<a href="${esc(it.go)}" data-nav="${esc(it.key || '')}">${esc(it.n)}</a>`;
      }).join('');
    }
    const sf = $('#sfNav');
    if (sf && NAV.footer) {
      // 社区预留位要三处一致（顶栏「更多」/ 页脚 / 移动端），所以这里也注入一次，
      // 而不是只在顶栏放一个 —— 声明了 slots 就要真的落在那些位置。
      sf.innerHTML = NAV.footer.map((col, i) =>
        `<div class="sfgrp"><b class="sfgt">${esc(col.n)}</b>${(col.items || []).map(navItemHtml).join('')}${i === NAV.footer.length - 1 ? reservedHtml() : ''}</div>`).join('');
    }
    const mp = $('#mnavPrim'), mf = $('#mnavFoot');
    if (mp && NAV.mobile) mp.innerHTML = (NAV.mobile.primary || []).map(x => navItemHtml(x)).join('');
    if (mf && NAV.mobile) mf.innerHTML = (NAV.mobile.more || []).map(x => navItemHtml(x)).join('') + reservedHtml();
  }

  /* ---------- 首页：一句话轮播（动效服务于「这站能解决什么」，不是装饰） ---------- */
  let ROT_T = null;
  function startHeroRot() {
    const el = $('#hRotT');
    if (!el || ROT_T) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const items = ['日常回归自动化', '写用例 / 测试设计', '先学 AI 测试', '团队协作共享', '合规、代码不出境', '把预算压到最低'];
    let i = 0;
    ROT_T = setInterval(() => {
      if (state.view !== 'home' || document.hidden) return;
      i = (i + 1) % items.length;
      el.classList.add('flip');
      setTimeout(() => { el.textContent = items[i]; el.classList.remove('flip'); }, 200);
    }, 2800);
  }

  /* ---------- 主路由 ----------
     route() 只做一件事：把渲染异常接住；真正分派在 routeInner()。
     这样任何一个页面渲染抛错，用户看到的是「出错页 + 堆栈」，而不是白屏。 */
  /* 每个页面的区块渲染器。合并前它们各自是一个页面，现在按页归拢，
     进一次页面就把这一页所有区块画完——不再有「进来先看到空壳」的中间态。 */
  const RENDERERS = {
    tools: [renderTools, renderCaps, renderVersus, renderMatrix, renderOverview],
    plans: [renderPlans, renderPromos, renderFree],
    stacks: [renderBundles, renderStack, renderCalc, renderDiagRecs, renderPlan, renderReport, renderOpinion],
    signal: [renderNews, renderEvents, renderImpact],
    career: [renderRoles, renderRoadmap, renderPersona],
    library: [renderCommunity, renderEvalset, renderAitest],
    data: [renderHealth, renderSources, renderChangelog]
  };

  /* 临时关掉 CSS 的平滑滚动，把一个滚动动作变成瞬时。
     不这么做的话，换页滚到顶和章节跳转是两段动画，会互相打断。 */
  function scrollInstant(fn) {
    const root = document.documentElement;
    const prev = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    fn();
    root.style.scrollBehavior = prev;
  }

  function route() {
    try { routeInner(); }
    catch (err) { showError(err); }
  }

  function routeInner() {
    // hash 可能是 #tools?sec=matrix 这种带参数的形态，取 ? 之前那段当页面名
    const rawHash = (location.hash || '#home').replace('#', '');
    const qi = rawHash.indexOf('?');
    let v = (qi >= 0 ? rawHash.slice(0, qi) : rawHash) || 'home';
    const params = qi >= 0 ? rawHash.slice(qi + 1) : '';
    // 旧地址重定向：25 个功能页合并成 8 页后，别人分享的旧链接还在
    const rd = REDIRECTS[v] || (NAV.redirects || {})[v];
    if (rd && rd !== v) { history.replaceState(null, '', '#' + rd + (params ? '?' + params : '')); v = rd; }
    // 未知地址不再静默回落到首页——给 404 页，把全部入口摆出来
    if (v && VIEWS.indexOf(v) < 0) v = '404';
    if (!v) v = 'home';
    const from = state.view;
    state.view = v;
    pushRecent(v);

    // 顶部主导航高亮：8 个页面都在一级，站务页收在「更多」里
    const navKey = FEATURE_VIEWS.indexOf(v) >= 0 ? v
      : v === 'search' ? 'search'
        : v === 'mine' ? 'mine'
          : (SITE_PAGES.indexOf(v) >= 0 || v === '404' || v === 'error') ? 'more' : '';
    $$('.tnav a, .tnav .tddBtn').forEach(el => el.classList.toggle('on', el.dataset.nav === navKey));

    $$('.view').forEach(s => s.classList.toggle('on', s.id === 'v-' + v));
    /* 站内是 html{scroll-behavior:smooth}：直接 scrollTo 会变成一段动画，
       和紧接着的章节跳转抢滚动条，最后停在半路。换页要的是「立刻到顶」。 */
    scrollInstant(() => window.scrollTo(0, 0));

    chromeFor(v);
    if (FEATURE_VIEWS.indexOf(v) >= 0) guideFor(v);

    // 一页里有多个区块：整页的渲染器一次跑完，用户看到的是一个完整页面
    const R = RENDERERS[v];
    if (R) R.forEach(fn => fn());
    if (v === '404') render404();
    if (v === 'error') fillErrLinks();
    if (v === 'search') renderSearch();
    if (v === 'mine') renderMine();
    if (v === 'feedback') renderFeedback();
    if (v === 'about' || v === 'help' || v === 'privacy' || v === 'contact') renderStaticPage(v);

    // ?sec=xxx：页顶章节条点的就是这个，直接滚到那一块
    const sec = (params.match(/(?:^|&)sec=([a-z0-9-]+)/) || [])[1];
    if (sec) {
      const el = document.getElementById('sec-' + sec);
      /* 延后一点再滚：同一轮里各区块还在渲染（热力图、表格会改高度），
         立刻滚会滚到一个马上就不成立的位置，看起来像「点了没反应」。 */
      if (el) setTimeout(() => scrollInstant(() => el.scrollIntoView({ block: 'start' })), 120);
    }

    // 每页独立标题；首页用完整站名
    /* 首页标题要和 build.js 注入的静态 <title> 一致：搜索引擎会执行 JS，
       两处不一致时它可能取运行时那个，等于静态标签白写了。 */
    document.title = v === 'home'
      ? `AI 编程工具与套餐价格对比（${TOOLS.length} 款 / ${PLANS.length} 档）· AI Test Stack`
      : (VIEW_NAME[v] || v) + ' · AI Test Stack';
    if (v !== from) track('view', { v, from });
  }
  window.addEventListener('hashchange', () => {
    // 同一个文档内改 hash（地址栏粘贴别人的分享链接、点站内锚点）也要还原状态，
    // 否则只有「刷新」才生效，用户会以为链接坏了。
    const raw = location.hash.slice(1);
    const qi = raw.indexOf('?');
    if (qi >= 0) {
      suppressSync = true;
      hashToState(raw.slice(qi + 1));
      suppressSync = false;
    }
    route();
  });

  /* =========================================================
     OVERVIEW
     ========================================================= */
  function renderOverview() {
    const w = state.weights;
    const cnt = { tools: TOOLS.length, plans: PLANS.length, free: (FB.items || []).length, caps: CAP_LIST.length, roles: (ROLE.roles || []).length, news: (NEWS.events || []).length };
    $$('#v-overview [data-c]').forEach(b => { if (cnt[b.dataset.c] != null) b.textContent = cnt[b.dataset.c]; });
    const ranked = TOOLS.map(t => ({ t, s: toolScore(t, w) })).sort((a, b) => b.s - a.s);
    const top = ranked[0];

    const st = $('#ovStats');
    if (st) {
      st.innerHTML = [
        { k: '工具收录', v: TOOLS.length, d: '款工具（国内 + 国际）' },
        { k: '套餐收录', v: PLANS.length, d: '档国内外套餐' },
        { k: '能力维度', v: CAP_LIST.length, d: '项可量化能力' },
        { k: '数据核验', v: (META.lastVerified || '').slice(5), d: '最近一次人工核验' }
      ].map(x => `<div class="stat"><div class="k">${esc(x.k)}</div><div class="v">${esc(x.v)}</div><div class="d">${esc(x.d)}</div></div>`).join('');
    }

    const vd = $('#ovVerdict');
    if (vd && top) {
      const gap = ranked[1] ? (top.s - ranked[1].s).toFixed(2) : '—';
      vd.innerHTML = `
        <div class="vmain">
          <div class="vk">当前画像 · ${esc(CRIT.profiles[state.profile] ? CRIT.profiles[state.profile].name : '自定义权重')}</div>
          <div class="vn">${esc(top.t.name)} <span>· ${rnd(top.s / 5 * 100)}</span></div>
          <div class="vs">${esc(top.t.vendor)} · ${esc(top.t.tagline)}<br>
            领先第二名 <b>${esc(ranked[1] ? ranked[1].t.name : '—')}</b> ${gap} 分 ·
            月成本约 ¥${esc(top.t.monthlyCost)}</div>
        </div>
        <div class="vsc"><div class="n">${rnd(top.s / 5 * 100)}</div><div class="c">综合分</div></div>`;
    }

    const ov3 = $('#ovTop3');
    if (ov3) {
      ov3.innerHTML = ranked.slice(0, 3).map((x, i) => `
        <div class="rrow ${i === 0 ? 'top1' : i === 1 ? 'top2' : 'top3'}" data-open="${esc(x.t.id)}">
          <div class="rk">${i + 1}</div>
          <div class="rmain">
            <div class="rn">${esc(x.t.name)} <span class="vendor">${esc(x.t.vendor)}</span></div>
            <div class="rt">${esc(x.t.tagline)}</div>
            <div class="rbar"><i style="width:${rnd(x.s / 5 * 100)}%"></i></div>
          </div>
          <div class="rsc"><div class="n">${rnd(x.s / 5 * 100)}</div><div class="c">score</div></div>
        </div>`).join('');
      $$('#ovTop3 .rrow').forEach(r => r.onclick = () => openTool(r.dataset.open));
    }

    const ovQuick = $('#ovQuick');
    if (ovQuick) {
      const q = [
        { k: 'AI 小白，只想装一个', a: 'DeepSeek Harness + 火山方舟 Lite', d: '图形界面 + 国内直连 + ¥40 一个月还能试 6 家模型。', c: 'cyan' },
        { k: '功能测试，想少写点用例', a: '任意壳 + 沉淀成 Skill', d: '重点不是工具，是先把「需求 → 测试点 → 用例」这条链写成可复用资产。', c: 'violet' },
        { k: '要进 CI，跑自动化', a: 'DSH / Pi / Claude Code', d: '图形界面类（ZCode、Qoder、Kimi Code）直接出局——没法被流水线调用。', c: 'cyan' },
        { k: '模型要最强，钱不是问题', a: 'Claude Code + Max', d: '长任务稳定性、生态成熟度仍是第一。前提是能稳定访问且能付美元。', c: 'amber' },
        { k: '公司代码不能出境', a: 'DSH / 小米 MiMo / Hermes', d: 'GLM 明确数据可能用于训练且无退出选项，Kimi 明确禁企业场景。', c: 'rose' },
        { k: '想让它长期在线、自己变强', a: 'Hermes Agent', d: '唯一内置学习循环：自建技能 + 跨会话记忆 + 内置 cron + 20+ 消息平台。', c: 'violet' }
      ];
      const CM = { cyan: 'var(--cyan-t)', violet: 'var(--c5)', amber: 'var(--amber-t)', rose: 'var(--c3)' };
      ovQuick.innerHTML = q.map(x => `
        <div class="tcard" style="cursor:default">
          <div style="font-size:var(--fs-1);letter-spacing:.08em;color:var(--dim2);font-weight:700">${esc(x.k)}</div>
          <div style="font-size:var(--fs-3);font-weight:700;color:${CM[x.c]};line-height:1.4">${esc(x.a)}</div>
          <div class="td">${esc(x.d)}</div>
        </div>`).join('');
    }

    const ovLog = $('#ovLog');
    if (ovLog) {
      ovLog.innerHTML = LOG.slice(0, 4).map(e => `
        <div class="cl">
          <div class="d">${esc(e.date)}</div>
          <div class="b">
            <div class="t"><span class="kd ${esc(e.kind)}">${esc(({ add: '新增', chg: '变更', del: '下线', note: '备注' })[e.kind] || e.kind)}</span>${esc(e.title)}</div>
            <div class="x">${esc(e.body)}</div>
          </div>
        </div>`).join('');
    }
  }

  /* =========================================================
     MATRIX
     ========================================================= */

  /* ---------- 夺冠率分布 ----------
     为什么要这块：页面一直说「换权重排名会变」，但用户拖滑块时如果冠军
     始终是同一款，这句话就是空洞的。所以这里把「随机权重下谁能赢」摊开。

     两列数字，回答两个不同的问题：
     · 全局 —— 权重在整个 0–10 空间里均匀乱撒时，各款夺冠的百分比。
       它是个固定结论（和 build.js 的门禁同算法），用来看「这套评分表有没有
       被某一款吃死」。
     · 附近 —— 在「你现在这组权重」上下浮动的范围内重新撒权重。
       它会随滑块实时变化，用来看「照我这个偏好，冠军到底有多稳」。

     两列都用同一个 toolScore 算分，保证和上面的排名口径一致。
     ---------- */
  const WIN_GLOBAL = 20000;   // 全局列：和 build.js 门禁同口径
  const WIN_LOCAL = 6000;     // 附近列：要跟着滑块重算，样本少一点
  const WIN_JITTER = 3;       // 「附近」的浮动幅度（每个维度 ±3）

  /* mulberry32：确定性伪随机，和 build.js 门禁用同一算法——两边数字对得上 */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* 抽一组权重，返回 {w, tot}；tot=0（全零）返回 null 让调用方重抽 */
  function sampleWeights(pick, w) {
    let tot = 0;
    CRITERIA.forEach(c => { const v = pick(c); w[c.id] = v; tot += v; });
    return tot ? tot : 0;
  }

  /* 统计各工具夺冠次数；一局里并列第一的按人数均分，不偏袒列表顺序 */
  function runWinTally(samples, draw) {
    const win = {};
    TOOLS.forEach(t => win[t.id] = 0);
    let ties = 0, n = 0;
    const buf = {};
    while (n < samples) {
      const tot = draw(buf);
      if (!tot) continue;
      let best = -Infinity, bestIds = [];
      TOOLS.forEach(t => {
        const s = toolScore(t, buf);       // 复用排名用的同一个算分函数
        if (s > best + 1e-12) { best = s; bestIds = [t.id]; }
        else if (Math.abs(s - best) <= 1e-12) bestIds.push(t.id);
      });
      if (bestIds.length > 1) ties++;
      bestIds.forEach(id => { win[id] += 1 / bestIds.length; });
      n++;
    }
    const rates = {};
    TOOLS.forEach(t => rates[t.id] = win[t.id] / n * 100);
    return { rates, ties, n };
  }

  let _winGlobal = null;
  function globalWinRates() {
    if (_winGlobal) return _winGlobal;
    const rnd = mulberry32(20261029);     // 与 build.js 门禁同一个种子
    _winGlobal = runWinTally(WIN_GLOBAL, buf => {
      let tot = 0;
      CRITERIA.forEach(c => { const v = Math.floor(rnd() * 11); buf[c.id] = v; tot += v; });
      return tot;
    });
    return _winGlobal;
  }

  /* 以当前权重为中心、每维 ±WIN_JITTER 浮动；第 0 次固定用当前权重本身 */
  function localWinRates(weights) {
    const rnd = mulberry32(97531);
    let first = true;
    return runWinTally(WIN_LOCAL, buf => {
      if (first) {
        first = false;
        let tot = 0;
        CRITERIA.forEach(c => { const v = weights[c.id] || 0; buf[c.id] = v; tot += v; });
        if (tot) return tot;              // 全 0 时退回随机，别白算一局
      }
      let tot = 0;
      CRITERIA.forEach(c => {
        const base = weights[c.id] || 0;
        const v = Math.max(0, Math.min(10, Math.round(base + (rnd() * 2 - 1) * WIN_JITTER)));
        buf[c.id] = v; tot += v;
      });
      return tot;
    });
  }

  function renderWinRates() {
    const box = $('#mWinBars');
    if (!box) return;

    const g = globalWinRates();
    const l = localWinRates(state.weights);

    const rows = TOOLS.map(t => ({
      t,
      global: g.rates[t.id],
      local: l.rates[t.id]
    })).sort((a, b) => b.local - a.local || b.global - a.global);

    const maxLocal = Math.max(1, rows[0] ? rows[0].local : 1);
    const topLocal = rows[0];
    const globalTop = TOOLS.map(t => ({ t, pct: g.rates[t.id] })).sort((a, b) => b.pct - a.pct)[0];
    const globalWinners = TOOLS.filter(t => g.rates[t.id] > 0.5).length;
    const localWinners = rows.filter(r => r.local > 0.5).length;

    box.innerHTML =
      `<div class="winbar-head">
        <span>两列口径：<b>当前偏好附近</b> = 在这组权重上下 ±${WIN_JITTER} 浮动重撒 ${l.n.toLocaleString('en-US')} 组；<b>全局</b> = 0–10 均匀撒 ${g.n.toLocaleString('en-US')} 组</span>
      </div>
      <div class="winrow winhead">
        <div class="wrk"></div>
        <div class="wname">工具</div>
        <div class="wpct">当前偏好附近</div>
        <div class="wpct g">全局</div>
      </div>` +
      rows.map((r, i) => {
        const zero = r.local <= 0.01;
        return `<div class="winrow ${zero ? 'zero' : ''}">
          <div class="wrk">${i + 1}</div>
          <div>
            <div class="wname" title="${esc(r.t.name)} · ${esc(r.t.tagline)}">${esc(r.t.name)}</div>
            <div class="wtrack"><i style="width:${Math.max(zero ? 0 : 1.5, r.local / maxLocal * 100)}%"></i></div>
          </div>
          <div class="wpct">${r.local < 0.1 && r.local > 0 ? r.local.toFixed(2) : r.local.toFixed(1)}%</div>
          <div class="wpct g">${r.global < 0.1 && r.global > 0 ? r.global.toFixed(2) : r.global.toFixed(1)}%</div>
        </div>`;
      }).join('');

    const note = $('#mWinNote');
    if (note) {
      const concentrated = topLocal && topLocal.local > 40;
      note.className = 'note' + (concentrated ? ' warn' : '');
      note.innerHTML = concentrated
        ? `照你现在这组偏好，<b>${esc(topLocal.t.name)}</b> 拿走了 ${topLocal.local.toFixed(1)}% 的邻近组合——这组权重已经高度集中。` +
          `把几个权重往中间调，冠军就会换人；这恰好说明排名是被你调出来的，不是写死的。`
        : `照你现在这组偏好，最稳的是 <b>${esc(topLocal ? topLocal.t.name : '—')}</b> ${topLocal ? topLocal.local.toFixed(1) : '0'}%，` +
          `${localWinners} 款工具在附近仍有机会夺冠。` +
          `放到全局看，最高的是 <b>${esc(globalTop.t.name)}</b> ${globalTop.pct.toFixed(1)}%，` +
          `共 ${globalWinners} 款拿过第一${g.ties ? `（含 ${g.ties} 组并列，按人数均分）` : ''}——` +
          `没有哪一款能在所有权重下通吃，这正是「换权重排名会变」的意思。`;
    }
  }

  function renderMatrix() {
    // presets
    const pr = $('#mPresets');
    if (pr) {
      pr.innerHTML = Object.entries(CRIT.profiles).map(([id, p]) =>
        `<button class="preset ${id === state.profile ? 'on' : ''}" data-p="${esc(id)}">${p.icon} ${esc(p.name)}</button>`
      ).join('');
      $$('#mPresets .preset').forEach(b => b.onclick = () => { applyProfile(b.dataset.p); renderMatrix(); syncHash(); toast('已切换画像：' + CRIT.profiles[b.dataset.p].name); });
    }

    // sliders
    const sl = $('#mSliders');
    if (sl) {
      sl.innerHTML = CRIT.criteria.map(c => `
        <div class="sl">
          <div class="lab"><span>${c.icon} ${esc(c.name)}</span><span class="val" data-v="${esc(c.id)}">${state.weights[c.id]}</span></div>
          <input type="range" min="0" max="10" step="1" value="${state.weights[c.id]}" data-c="${esc(c.id)}" title="${esc(c.desc)}">
        </div>`).join('');
      $$('#mSliders input[type=range]').forEach(r => {
        const upd = () => {
          r.style.setProperty('--p', (r.value / 10 * 100) + '%');
        };
        upd();
        r.oninput = () => {
          state.weights[r.dataset.c] = +r.value;
          const v = $(`#mSliders .val[data-v="${r.dataset.c}"]`);
          if (v) v.textContent = r.value;
          upd();
          state.profile = '';
          $$('#mPresets .preset').forEach(b => b.classList.remove('on'));
          renderMatrixResults();
          renderWinRates();
          syncHash();
        };
      });
    }

    // switches
    const swCn = $('#swCn'), swSc = $('#swSc'), bud = $('#mBudget');
    if (swCn) { swCn.checked = state.cnOnly; swCn.onchange = () => { state.cnOnly = swCn.checked; renderMatrixResults(); }; }
    if (swSc) { swSc.checked = state.scriptOnly; swSc.onchange = () => { state.scriptOnly = swSc.checked; renderMatrixResults(); }; }
    if (bud) { bud.value = state.budget; bud.onchange = () => { state.budget = +bud.value || 0; renderMatrixResults(); }; }

    renderMatrixResults();
    renderWinRates();
  }

  function renderMatrixResults() {
    const w = state.weights;
    const wSum = Object.values(w).reduce((a, b) => a + b, 0);

    // 权重全零时所有工具同分 0，排序退化成数组原序——冠军只是「谁在数组里排第一」，
    // 不代表任何东西。这种情况必须明确提示，否则用户会以为排名有意义。
    const degenerate = wSum === 0;

    const scored = TOOLS.map(t => {
      let ex = null;
      if (state.cnOnly && !t.cnDirect) ex = '需境外网络';
      else if (state.scriptOnly && !t.scriptable) ex = '不可脚本化';
      else if (t.monthlyCost > state.budget) ex = '超预算';
      return { t, s: toolScore(t, w), ex };
    });
    scored.sort((a, b) => (!!a.ex !== !!b.ex) ? (a.ex ? 1 : -1) : (b.s - a.s));

    const active = scored.filter(x => !x.ex);
    const top = degenerate ? null : active[0];
    const vd = $('#mVerdict');
    if (vd) {
      if (degenerate) {
        vd.innerHTML = `
          <div class="vmain">
            <div class="vk">权重全是 0</div>
            <div class="vn" style="color:var(--amber-t)">现在没有可比的东西</div>
            <div class="vs">九个维度都设成 0 时，每个工具得分都是 0，下面的排名只是数组顺序，<b>不代表任何结论</b>。<br>
              把你在乎的那几项调上去——比如成本、测试适配、国内可用性。</div>
          </div>
          <div class="vsc"><div class="n" style="color:var(--amber-t)">—</div><div class="c">综合分</div></div>`;
      } else if (top) {
        const second = active[1], third = active[2];
        vd.innerHTML = `
          <div class="vmain">
            <div class="vk">${esc(CRIT.profiles[state.profile] ? CRIT.profiles[state.profile].name : '自定义权重')}</div>
            <div class="vn">${esc(top.t.name)} <span>· ${rnd(top.s / 5 * 100)}</span></div>
            <div class="vs">${esc(top.t.vendor)} · ${esc(top.t.tagline)}<br>
              ${second ? `领先 <b>${esc(second.t.name)}</b> ${(top.s - second.s).toFixed(2)} 分` : ''}${third ? `，第三名 ${esc(third.t.name)}` : ''}
              　·　月成本约 ¥${esc(top.t.monthlyCost)}</div>
            ${whyWin(top.t, second && second.t, CRIT.criteria, w, x => x.score) ? `<div class="vs" style="margin-top:6px;color:var(--c1)">▲ ${esc(whyWin(top.t, second && second.t, CRIT.criteria, w, x => x.score))}</div>` : ''}
          </div>
          <div class="vsc"><div class="n">${rnd(top.s / 5 * 100)}</div><div class="c">综合分</div></div>`;
      } else {
        vd.innerHTML = `<div class="vmain"><div class="vn">没有工具满足当前硬性条件</div>
          <div class="vs">试着放宽「国内直连」「可脚本化」或预算上限。</div></div>`;
      }
    }

    const rs = $('#mRankSub');
    if (rs) {
      rs.textContent = degenerate
        ? `${active.length} / ${TOOLS.length} 个工具通过筛选 · 权重合计 0 分，排名无意义`
        : `${active.length} / ${TOOLS.length} 个工具通过筛选 · 权重合计 ${wSum} 分`;
    }

    const el = $('#mRank');
    if (el) {
      el.innerHTML = scored.map((x, i) => {
        // 权重全零时不要给前三名上色，那会把「数组顺序」包装成「排名」
        const cls = x.ex ? 'excluded' : (degenerate ? '' : (i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : ''));
        return `<div class="rrow ${cls}" data-open="${esc(x.t.id)}">
          <div class="rk">${i + 1}</div>
          <div class="rmain">
            <div class="rn">${esc(x.t.name)}
              <span class="vendor">${esc(x.t.vendor)}</span>
              ${x.ex ? `<span class="flag warn">${esc(x.ex)}</span>` : (x.t.cnDirect && x.t.scriptable ? '<span class="flag ok">可落地</span>' : '')}
            </div>
            <div class="rt">${esc(x.t.tagline)} · 约 ¥${esc(x.t.monthlyCost)}/月</div>
            <div class="rbar"><i style="width:${Math.max(2, rnd(x.s / 5 * 100))}%"></i></div>
          </div>
          <div class="rsc"><div class="n">${rnd(x.s / 5 * 100)}</div><div class="c">score</div></div>
        </div>`;
      }).join('');
      $$('#mRank .rrow').forEach(r => r.onclick = () => openTool(r.dataset.open));
    }
  }

  /* =========================================================
     TOOLS
     ========================================================= */
  function renderTools() {
    const q = state.toolQuery.trim().toLowerCase();
    const kf = $('#tKind');
    if (kf) {
      const opts = [
        { id: 'all', n: '全部' },
        { id: 'shell', n: '编程外壳' },
        { id: 'qa', n: 'AI 测试平台' }
      ];
      kf.innerHTML = opts.map(o => {
        const n = o.id === 'all' ? TOOLS.length : TOOLS.filter(t => t.kind === o.id).length;
        return `<button class="seg ${state.toolKind === o.id ? 'on' : ''}" data-k="${o.id}">${o.n}<span>${n}</span></button>`;
      }).join('');
      $$('#tKind .seg').forEach(b => b.onclick = () => { state.toolKind = b.dataset.k; renderTools(); });
    }
    const rf = $('#tRegion');
    if (rf) {
      rf.innerHTML = [{ id: 'all', n: '全部' }, { id: 'cn', n: '国内直连' }, { id: 'global', n: '需境外' }]
        .map(o => `<button class="seg ${state.toolRegion === o.id ? 'on' : ''}" data-r="${o.id}">${o.n}</button>`).join('');
      $$('#tRegion .seg').forEach(b => b.onclick = () => { state.toolRegion = b.dataset.r; renderTools(); });
    }
    const list = TOOLS.filter(t => {
      if (state.toolKind !== 'all' && t.kind !== state.toolKind) return false;
      if (state.toolRegion !== 'all' && t.region !== state.toolRegion) return false;
      if (!q) return true;
      const hay = [t.name, t.vendor, t.tagline, t.what, t.use, (t.tags || []).join(' '), t.fit, t.models].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
    const tl = $('#tlCount');
    if (tl) tl.textContent = list.length === TOOLS.length ? TOOLS.length + ' 款工具' : list.length + ' / ' + TOOLS.length + ' 款工具';
    const g = $('#tgrid');
    if (!g) return;
    if (!list.length) { g.innerHTML = '<div class="empty">没有匹配的工具。试试「测试」「开源」「国内」。</div>'; return; }
    g.innerHTML = list.map(t => `
      <div class="tcard" data-id="${esc(t.id)}" tabindex="0" role="button" aria-label="查看 ${esc(t.name)} 详情">
        <div class="th">
          <div class="logo" style="background:${esc(t.grad)}">${esc(t.letter)}</div>
          <div><div class="tn">${esc(t.name)}</div><div class="tv">${esc(t.vendor)}</div></div>
          <span class="tkind ${t.kind === 'qa' ? 'qa' : ''}">${t.kind === 'qa' ? '测试平台' : '编程外壳'}</span>
          ${favBtn('tool', t.id, t.name)}
        </div>
        <div class="td">${esc(t.tagline)}。${esc(String(t.what).split('。')[0])}。</div>
        <div class="tfoot">
          ${(t.tags || []).map(x => `<span class="tag c">${esc(x)}</span>`).join('')}
          <span class="tag ${t.cnDirect ? '' : 'r'}">${t.cnDirect ? '国内直连' : '需境外'}</span>
          <span class="tag ${t.license === '开源' || t.license === 'MIT' || t.license === '开源+订阅' ? 'v' : ''}">${esc(t.license)}</span>
        </div>
      </div>`).join('');
    $$('#tgrid .tcard').forEach(c => {
      c.onclick = () => openTool(c.dataset.id);
      c.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTool(c.dataset.id); } };
    });
  }

  /* ---------- provenance helpers ---------- */
  function provBadge(level) {
    const L = PROV[level];
    if (!L) return '';
    return `<span class="prov" style="background:${L.color}22;color:${L.color};border-color:${L.color}55" title="${esc(L.name)}：${esc(L.desc)}">${esc(L.short)}</span>`;
  }
  function provRow(label, level, hint) {
    const L = PROV[level];
    return `<div class="provrow">
      <div class="pl">${esc(label)}</div>
      <div class="pv">${provBadge(level)} <span style="color:${L ? L.color : 'var(--dim)'}">${esc(L ? L.name : '—')}</span></div>
      <div class="ph">${esc(hint)}</div>
    </div>`;
  }

  /* ---------- drawer ---------- */
  function openTool(id) {
    const t = TOOLS.find(x => x.id === id);
    if (!t) return;
    const body = $('#dbody');
    if (!body) return;

    const groupsHtml = CAPS.groups.map(g => {
      const items = g.items.map(it => {
        const v = (t.capabilities || {})[it.id] || 0;
        return `<div class="sb" title="${esc(it.desc)}">
          <div class="n">${esc(it.name)}</div>
          <div class="t"><i style="width:${v / 5 * 100}%;background:${barGrad(v)}"></i></div>
          <div class="v">${v}</div>
        </div>`;
      }).join('');
      return `<div class="dsec"><div class="h">${g.icon} ${esc(g.name)}</div>${items}</div>`;
    }).join('');

    body.innerHTML = `
      <button class="dx" id="dclose" title="关闭 (Esc)">×</button>
      <div class="dhead">
        <div class="logo" style="background:${esc(t.grad)}">${esc(t.letter)}</div>
        <div><div class="dk">${esc(t.vendor)}</div><div class="dn">${esc(t.name)}</div></div>
      </div>
      <div class="dtag">${esc(t.tagline)}</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px">
        ${(t.tags || []).map(x => `<span class="tag c">${esc(x)}</span>`).join('')}
        <span class="tag ${t.license === '开源' || t.license === 'MIT' ? 'v' : ''}">${esc(t.license)}</span>
        <span class="tag ${t.cnDirect ? '' : 'r'}">${t.cnDirect ? '国内直连' : '需境外'}</span>
      </div>

      <div class="dmeta">
        <div class="m"><div class="k">类型</div><div class="v">${t.kind === 'qa' ? 'AI 测试平台' : '编程外壳'}</div></div>
        <div class="m"><div class="k">月成本估算</div><div class="v" style="color:var(--amber-t)">¥${esc(t.monthlyCost)} / 月</div></div>
        <div class="m"><div class="k">收费方式</div><div class="v">${esc(t.pricing)}</div></div>
        <div class="m"><div class="k">可脚本化</div><div class="v">${t.scriptable ? '✅ CLI / API' : '! 仅图形界面'}</div></div>
        <div class="m"><div class="k">能力均值</div><div class="v">${capAvg(t).toFixed(2)} / 5</div></div>
      </div>

      <div class="dsec"><div class="h">它是干什么的</div><p>${esc(t.what)}</p></div>
      <div class="dsec"><div class="h">拿它干什么（测试视角）</div><p>${esc(t.use)}</p></div>
      <div class="dsec"><div class="h">优势</div>
        <ul class="ul good">${(t.strengths || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
      <div class="dsec"><div class="h">短板</div>
        <ul class="ul bad">${(t.weaknesses || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
      <div class="dsec"><div class="h">适合谁</div><p>${esc(t.fit)}</p></div>
      <div class="dsec"><div class="h">模型适配能力</div><p>${esc(t.models)}</p></div>
      ${t.risk ? `<div class="dsec"><div class="h">主要风险</div><p style="color:var(--c3)">${esc(t.risk)}</p></div>` : ''}

      <div class="dsec"><div class="h">分数是怎么来的</div>
        <div class="provbox">
          ${provRow('月成本 / 可用性 / 脚本化 / 许可证', t.provenance && t.provenance.monthlyCost, '官方定价页与产品文档')}
          ${provRow('九维决策分', t.provenance && t.provenance.score, '编辑判断，非跑分')}
          ${provRow('20 项能力分', t.provenance && t.provenance.capabilities, '依据架构与公开信息推断')}
        </div>
        <div class="note" style="margin-top:10px;font-size:var(--fs-1)">${esc(t.provenanceNote || '')}</div>
      </div>

      <div class="dsec"><div class="h">九维评分${provBadge(t.provenance && t.provenance.score)}</div>
        <div class="scorebars">
          ${CRIT.criteria.map(c => {
            const v = t.score[c.id] || 0;
            return `<div class="sb"><div class="n">${c.icon} ${esc(c.name)}</div>
              <div class="t"><i style="width:${v / 5 * 100}%;background:${barGrad(v)}"></i></div>
              <div class="v">${v}</div></div>`;
          }).join('')}
        </div>
      </div>

      ${groupsHtml}

      <div class="dsec">
        <a class="btn" href="${esc(t.link)}" target="_blank" rel="noopener">打开官网 ↗</a>
        <span class="mini" style="margin-left:10px">数据核验：${esc(t.verified)}</span>
      </div>`;

    const dr = $('#drawer');
    dr.classList.add('on');
    dr.setAttribute('aria-hidden', 'false');
    lastFocus = document.activeElement;
    $('#scrim').classList.add('on');
    const c = $('#dclose');
    if (c) { c.onclick = closeDrawer; c.focus(); }
  }
  let lastFocus = null;
  function closeDrawer() {
    const dr = $('#drawer');
    if (!dr.classList.contains('on')) return;
    dr.classList.remove('on');
    dr.setAttribute('aria-hidden', 'true');
    if (lastFocus && lastFocus.focus) { lastFocus.focus(); lastFocus = null; }
    $('#scrim').classList.remove('on');
  }

  /* =========================================================
     CAPABILITIES HEATMAP
     ========================================================= */
  function buildHeat(sel, compact) {
    const wrap = $(sel);
    if (!wrap) return;
    const tools = TOOLS.slice().sort((a, b) => {
      if (state.capSort === 'name') return a.name.localeCompare(b.name);
      return capAvg(b) - capAvg(a);
    });

    let head = `<thead><tr><th style="text-align:left;padding-left:12px">能力 \\ 工具</th>`;
    tools.forEach(t => {
      head += `<th><span class="grp">${esc(t.letter)}</span>${esc(t.name.split(' ')[0])}</th>`;
    });
    head += `<th style="background:var(--panel2)">均值</th></tr></thead>`;

    let body = '<tbody>';
    CAPS.groups.forEach(g => {
      body += `<tr class="gsep"><th colspan="${tools.length + 2}" style="text-align:left;padding:8px 12px;background:var(--panel2);font-size:var(--fs-1);color:var(--cyan-t);letter-spacing:.08em">${g.icon} ${esc(g.name)}${compact ? '' : ` <span style="color:var(--dim2);font-weight:600;letter-spacing:0">· ${esc(g.desc)}</span>`}</th></tr>`;
      g.items.forEach(it => {
        const vals = tools.map(t => (t.capabilities || {})[it.id] || 0);
        const rowAvg = vals.reduce((a, b) => a + b, 0) / vals.length;
        body += `<tr><th title="${esc(it.desc)}">${esc(it.name)}${compact ? '' : `<span class="vv">${esc(it.desc)}</span>`}</th>`;
        vals.forEach((v, vi) => {
          body += `<td class="cell ${lvClass(v)}" title="${esc(tools[vi].name)} · ${esc(it.name)} · ${v} 分（${esc(LEVEL[v] ? LEVEL[v].label : '')}）">${v}</td>`;
        });
        body += `<td class="cell blank" style="font-family:var(--mono);font-size:var(--fs-1);color:var(--dim2)">${rowAvg.toFixed(1)}</td></tr>`;
      });
    });
    body += '</tbody>';

    wrap.innerHTML = `<table class="hm">${head}${body}</table>`;
  }

  function renderHeat(sel, compact) {
    buildHeat(sel, compact);
    if (compact) {
      const lg = $('#ovHeatLegend');
      if (lg) lg.innerHTML = (CAPS.levels || []).map(l => `<span><i class="${lvClass(l.v)}"></i>${l.v} ${esc(l.label)}</span>`).join('');
    }
  }

  function renderCaps() {
    buildHeat('#hmTable', false);
    const lg = $('#hmLegend');
    if (lg) {
      lg.innerHTML = (CAPS.levels || []).map(l =>
        `<span><i class="${lvClass(l.v)}"></i>${l.v} · ${esc(l.label)}</span>`).join('');
    }

    const sel = $('#capSort');
    if (sel) {
      sel.value = state.capSort;
      sel.onchange = () => { state.capSort = sel.value; renderCaps(); };
    }
  }

  /* =========================================================
     PLANS
     ========================================================= */
  function formDesc(id) {
    return ({
      coding: '按请求次数或积分计费，绑工具白名单，通常聚合多家模型。额度按 5 小时 / 周 / 月多周期限制。',
      token: 'Credits 统一抵扣，一份订阅可跨文本、图像、视频、语音模型。适合要在一个订阅里解决多种模态。',
      agent: 'AFP 积分制，除编程外还含多模态生成和 Harness 工具链（联网搜索、内置记忆、Auto 路由）。',
      member: '编程能力内嵌在产品会员里，与办公、研究等功能共享同一个额度池。',
      paygo: '无月费，按实际 token 用量结算。没有额度天花板，也没有工具白名单。'
    })[id] || '';
  }

  /* 价格溯源：一条价格配一行「什么时候核的、核了几天了、源在哪」。
     超过 45 天自动标黄——把"可能过期"做成可见事实，而不是等用户踩坑。 */
  function provHtml(p) {
    const v = p.verified || META.lastVerified;
    let days = null;
    if (v) {
      const t = new Date(v + 'T00:00:00').getTime();
      if (!isNaN(t)) days = Math.max(0, Math.round((Date.now() - t) / 86400000));
    }
    const stale = days != null && days > 45;
    return `<div class="prov${stale ? ' stale' : ''}">${stale ? '! 可能过期' : '✓ 已核'} ${esc(v || '—')}${days != null ? ` · ${days} 天前` : ''}${p.link ? ` · <a href="${esc(p.link)}" target="_blank" rel="noopener">源</a>` : ''}</div>`;
  }

  /* 排序状态只有一处入口：桌面点表头、手机点 #pSortMini 都走这里。
     两处各写一份的话，迟早会出现「手机点了价格、桌面表头还显示 ↕」。 */
  function setPlanSort(key) {
    if (!key) state.planSort = { key: '', dir: 'desc' };
    else if (state.planSort.key !== key) state.planSort = { key, dir: key === 'score' ? 'desc' : 'asc' };
    else state.planSort.dir = state.planSort.dir === 'asc' ? 'desc' : 'asc';
    renderPlans();
    syncHash();
  }

  function renderPlans() {
    const rf = $('#pRegion');
    if (rf) {
      const opts = [
        { id: 'all', n: '全部' },
        { id: 'cn', n: '国内' },
        { id: 'global', n: '国际' }
      ];
      rf.innerHTML = opts.map(o => {
        const n = o.id === 'all' ? PLANS.length : PLANS.filter(p => p.region === o.id).length;
        return `<button class="seg ${state.planRegion === o.id ? 'on' : ''}" data-r="${o.id}">${o.n}<span>${n}</span></button>`;
      }).join('');
      $$('#pRegion .seg').forEach(b => b.onclick = () => { state.planRegion = b.dataset.r; state.planSort = { key: '', dir: 'desc' }; renderPlans(); syncHash(); });
    }
    renderPlanLadder();
    const poolR = PLANS.filter(p => state.planRegion === 'all' || p.region === state.planRegion);
    const rng = $('#plRange');
    if (rng && poolR.length) {
      const priced = poolR.filter(p => p.price > 0);
      const lo = priced.reduce((a, b) => (a.price <= b.price ? a : b));
      const hi = priced.reduce((a, b) => (a.price >= b.price ? a : b));
      const usd = poolR.filter(p => p.currency === 'USD').length;
      rng.innerHTML = `${poolR.length} 个档位（国内 ${poolR.filter(p => p.region === 'cn').length} · 国际 ${usd}），从 <b>${money(lo)}</b> 的 ${esc(lo.name)} ${esc(lo.tier)} 到 <b>${money(hi)}</b> 的 ${esc(hi.name)} ${esc(hi.tier)}。美元按 ${esc(String((META.fx || {}).USD || 7.25))} 折算。`;
    }
    const pr = $('#pPresets');
    if (pr) {
      pr.innerHTML = Object.entries(CRIT.planProfiles).map(([id, p]) =>
        `<button class="preset ${id === state.planProfile ? 'on' : ''}" data-p="${esc(id)}">${p.icon} ${esc(p.name)}</button>`
      ).join('');
      $$('#pPresets .preset').forEach(b => b.onclick = () => { applyPlanProfile(b.dataset.p); state.planSort = { key: '', dir: 'desc' }; renderPlans(); syncHash(); });
    }

    // 形态筛选（Coding / Token / Agent / 会员 / 按量）
    const tf = $('#pTypeFilter');
    if (tf) {
      const FORMS = [
        { id: 'all', n: '全部' },
        { id: 'coding', n: 'Coding Plan' },
        { id: 'token', n: 'Token Plan' },
        { id: 'agent', n: 'Agent Plan' },
        { id: 'member', n: '会员制' },
        { id: 'paygo', n: '按量' }
      ];
      tf.innerHTML = FORMS.map(t => {
        const base = PLANS.filter(p => state.planRegion === 'all' || p.region === state.planRegion);
        const n = t.id === 'all' ? base.length : base.filter(p => p.form === t.id).length;
        if (t.id !== 'all' && n === 0) return '';
        return `<button class="preset ${state.planType === t.id ? 'on' : ''}" data-ty="${esc(t.id)}">${esc(t.n)} <span style="opacity:.55;font-family:var(--mono);font-size:var(--fs-1)">${n}</span></button>`;
      }).join('');
      $$('#pTypeFilter .preset').forEach(b => b.onclick = () => { state.planType = b.dataset.ty; state.planSort = { key: '', dir: 'desc' }; renderPlans(); syncHash(); });

      // 形态说明
      const fdesc = $('#pFormDesc');
      if (fdesc) {
        const cur = FORMS.find(f => f.id === state.planType);
        fdesc.innerHTML = state.planType === 'all'
          ? '<b>四种形态计费单位完全不同</b>：Coding Plan 按请求次数/积分，Token Plan 按 Credits 统一抵扣，Agent Plan 按 AFP 积分，会员制与产品会员共享额度池。混在一起比价会得出错误结论，请先选形态。'
          : `<b>${esc(cur ? cur.n.replace(/^\S+\s/, '') : '')}</b>：${esc(formDesc(state.planType))}`;
      }
    }

    const pool = PLANS.filter(p =>
      (state.planType === 'all' || p.form === state.planType) &&
      (state.planRegion === 'all' || p.region === state.planRegion));
    const byScore = pool.map(p => ({ p, s: planScore(p, state.planWeights) })).sort((a, b) => b.s - a.s);
    const top = byScore[0];
    const sub = byScore[1];
    const SORTERS = {
      price: (a, b) => (a.p.price - b.p.price),
      score: (a, b) => (a.s - b.s)
    };
    const scored = state.planSort.key && SORTERS[state.planSort.key]
      ? byScore.slice().sort((a, b) => (state.planSort.dir === 'asc' ? 1 : -1) * SORTERS[state.planSort.key](a, b))
      : byScore;

    const vd = $('#pVerdict');
    if (vd && top) {
      const formNames = { coding: 'Coding Plan', token: 'Token Plan', agent: 'Agent Plan', member: '会员制', paygo: '按量 API' };
      const typeLabel = state.planType === 'all' ? '' : ` · ${formNames[state.planType] || state.planType}`;
      vd.innerHTML = `
        <div class="vmain">
          <div class="vk">${esc((CRIT.planProfiles[state.planProfile] || {}).name || '自定义权重')}${esc(typeLabel)}</div>
          <div class="vn">${esc(top.p.name)} ${esc(top.p.tier)} <span>· ${money(top.p)}/月</span></div>
          <div class="vs">${esc(top.p.verdict || '')}<br>
            ${sub ? `第二名 <b>${esc(sub.p.name)} ${esc(sub.p.tier)}</b>，差 ${(top.s - sub.s).toFixed(1)} 分` : ''}</div>
          ${whyWin(top.p, sub && sub.p, CRIT.planCriteria, state.planWeights, x => x.s) ? `<div class="vs" style="margin-top:6px;color:var(--c1)">▲ ${esc(whyWin(top.p, sub && sub.p, CRIT.planCriteria, state.planWeights, x => x.s))}</div>` : ''}
        </div>
        <div class="vsc"><div class="n">${rnd(top.s / 5 * 100)}</div><div class="c">综合分</div></div>`;
    }

    // 只比订阅档的「小冠军」
    const sb = $('#pSubBest');
    if (sb) {
      const subs = PLANS.filter(p => (p.type || '订阅') === '订阅')
        .map(p => ({ p, s: planScore(p, state.planWeights) })).sort((a, b) => b.s - a.s);
      const s1 = subs[0], s2 = subs[1];
      sb.innerHTML = s1 ? `
        <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:8px">
          <div style="font-size:var(--fs-6);font-weight:700;letter-spacing:-.3px">${esc(s1.p.name)} ${esc(s1.p.tier)}</div>
          <div style="font-family:var(--mono);color:var(--amber-t);font-weight:700">${money(s1.p)}/月</div>
          <div style="font-family:var(--mono);color:var(--cyan-t);font-weight:700;margin-left:auto">${rnd(s1.s / 5 * 100)}</div>
        </div>
        <div class="mini" style="margin-bottom:10px">${esc(s1.p.verdict || '')}</div>
        <ul class="ul good">${(s1.p.pros || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <div class="note bad" style="margin-top:10px;font-size:var(--fs-2)">短板：${esc((s1.p.cons || []).join('；'))}</div>
        ${s2 ? `<div class="mini" style="margin-top:10px">第二名：${esc(s2.p.name)} ${esc(s2.p.tier)} ¥${esc(s2.p.price)} · ${rnd(s2.s / 5 * 100)} 分</div>` : ''}
      ` : '<div class="empty">当前筛选下没有订阅档</div>';
    }

    const tb = $('#planBody');
    if (tb) {
      const shown = state.planLimit ? scored.slice(0, state.planLimit) : scored;
      const pc = $('#pCount');
      if (pc) pc.textContent = `显示 ${shown.length} / ${scored.length} 档`;
      const pm = $('#pMore');
      if (pm) {
        pm.textContent = state.planLimit ? `显示全部 ${scored.length} 档` : '收起，只看前 20';
        pm.onclick = () => { state.planLimit = state.planLimit ? 0 : 20; renderPlans(); };
      }
      tb.innerHTML = shown.map((x, i) => {
        const p = x.p;
        const picked = state.pickedPlans.indexOf(p.id) >= 0;
        /* data-label 是给移动端看的：≤760px 表头会被藏掉，每格用 ::before 把列名补回来，
           否则一张 8 列的宽表在手机上只剩一堆没有表头的数字。 */
        return `<tr class="${picked ? 'picked' : ''}">
          <td class="pnum">${String(i + 1).padStart(2, '0')}</td>
          <td class="nm">${esc(p.name)}<small>${esc(p.tier)} · ${esc(p.vendor)} · ${p.region === 'cn' ? '国内' : '国际'}</small><div class="pmodels">${esc(p.models)}</div></td>
          <td data-label="形态"><span class="tag" style="white-space:nowrap">${esc(p.formName || '')}</span></td>
          <td class="pr" data-label="月价" data-price="${p.price}">${money(p)}<div class="mini">${esc(p.priceNote || '')}</div>${provHtml(p)}</td>
          <td class="pscore" data-label="综合分">${rnd(x.s / 5 * 100)}</td>
          <td data-label="额度">${esc(p.quota)}<div class="mini pmuted">${esc(p.quotaUnit || '—')} · ${esc(p.window || '—')}</div><div class="ptools">${esc(p.tools)}</div></td>
          <td data-label="风险">${(p.overage || p.risk) ? `<span class="mini">超限：${esc(p.overage || '—')}</span><div class="mini pdanger">${esc(p.risk)}</div>` : ''}${(p.restrictions || []).length ? `<div class="restr">${p.restrictions.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''}</td>
          <td data-label="选择"><button class="btn sm ${picked ? 'on' : ''}" data-pick="${esc(p.id)}">${picked ? '已选' : '选它'}</button></td>
        </tr>`;
      }).join('');
      $$('#planBody [data-pick]').forEach(b => b.onclick = () => {
        const id = b.dataset.pick;
        const i = state.pickedPlans.indexOf(id);
        if (i >= 0) state.pickedPlans.splice(i, 1);
        else state.pickedPlans = [id]; // 单选：套餐只选一个
        localStorage.setItem('ats_picked', JSON.stringify(state.pickedPlans));
        renderPlans();
        syncHash();
        toast(i >= 0 ? '已取消选择' : '已记为你的选择（套餐单选）');
      });
    }

    /* ---- v9：表头排序控件 ---- */
    $$('#planTable th.sortable').forEach(th => {
      const key = th.dataset.sort;
      const active = state.planSort.key === key;
      th.setAttribute('aria-sort', active ? (state.planSort.dir === 'asc' ? 'ascending' : 'descending') : 'none');
      const mark = th.querySelector('.sortMark');
      if (mark) mark.textContent = active ? (state.planSort.dir === 'asc' ? '↑' : '↓') : '↕';
      const btn = th.querySelector('button');
      if (btn) btn.onclick = () => {
        setPlanSort(key);
        const label = key === 'price' ? '月价' : '综合分';
        toast(`表格已按${label}${state.planSort.dir === 'asc' ? '从低到高' : '从高到低'}排（结论仍按综合分）`);
      };
    });

    /* ---- 手机上的排序控件：≤760px 表头被藏掉了，不给一组按钮就点不到排序 ---- */
    const mini = $('#pSortMini');
    if (mini) {
      const cur = state.planSort.key;
      const opts = [
        { k: '', n: '默认顺序' },
        { k: 'price', n: '月价' + (cur === 'price' ? (state.planSort.dir === 'asc' ? ' ↑' : ' ↓') : '') },
        { k: 'score', n: '综合分' + (cur === 'score' ? (state.planSort.dir === 'asc' ? ' ↑' : ' ↓') : '') }
      ];
      mini.innerHTML = opts.map(o =>
        `<button class="seg ${cur === o.k ? 'on' : ''}" type="button" data-ps="${o.k}" aria-pressed="${cur === o.k}">${o.n}</button>`
      ).join('');
      $$('#pSortMini .seg').forEach(b => b.onclick = () => setPlanSort(b.dataset.ps));
    }

    /* ---- v9：核验新鲜度条（阈值与数据健康页同源，不另立一套） ---- */
    const fresh = $('#pFresh');
    if (fresh) {
      const limit = META.staleAfterDays || 30;
      const ages = pool.map(p => daysAgo(p.verified || META.lastVerified));
      const inTime = ages.filter(d => d != null && d <= limit).length;
      const late = pool.length - inTime;
      fresh.innerHTML = `<span class="fk">核验新鲜度</span>` +
        `<b>${inTime} / ${pool.length}</b><span>档在 ${limit} 天内核过</span>` +
        (late ? `<span class="warn">⚠ ${late} 档超期或未标核验日，下单前以官网为准</span>` : '<span>全部在期内</span>') +
        `<a href="#health">核验台账 ↗</a>`;
    }

    /* ---- v9：阶梯降为次要视图，默认折叠 ---- */
    const lpanel = $('#pLadderPanel'), ltoggle = $('#pLadderToggle');
    if (lpanel && ltoggle) {
      const flip = () => {
        const closed = lpanel.classList.toggle('is-closed');
        ltoggle.setAttribute('aria-expanded', closed ? 'false' : 'true');
        const chev = ltoggle.querySelector('.chev');
        if (chev) chev.textContent = closed ? '＋' : '－';
      };
      ltoggle.onclick = flip;
      ltoggle.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); }
      };
    }
  }

  /* =========================================================
     BUNDLES
     ---------------------------------------------------------
     为什么用「硬筛选」而不是只调权重：
     权重只能让分数轻微移动，选不出真正不同的答案。
     真实决策是先排除「我做不到的」——小白不可能用纯 CLI，
     所以要进 CI 的人不该看到只有图形界面的方案。
     先筛后排，冠军才会真的变。
     ========================================================= */
  const BUNDLE_PROFILES = {
    all: {
      name: '全部', icon: '⊞',
      desc: '不筛，看全量排序',
      w: { coding: 8, value: 8, flex: 8, cn: 8, ci: 8, test: 8, ease: 8 },
      filter: () => true
    },
    begin: {
      name: '新手友好', icon: '◌',
      desc: '排除纯命令行/要写配置的方案（上手分 < 4 的全部去掉）',
      w: { coding: 7, value: 8, flex: 5, cn: 9, ci: 2, test: 6, ease: 10 },
      filter: b => (b.s.ease || 0) >= 4
    },
    ci: {
      name: '要进 CI', icon: '⚙',
      desc: '排除进不了流水线的方案（CI 分 < 8 的全部去掉）',
      w: { coding: 7, value: 6, flex: 8, cn: 7, ci: 10, test: 9, ease: 3 },
      filter: b => (b.s.ci || 0) >= 8
    },
    cheap: {
      name: '¥60 以内', icon: '¥',
      desc: '只看月成本 ≤ ¥60 的组合',
      w: { coding: 7, value: 10, flex: 7, cn: 9, ci: 7, test: 7, ease: 6 },
      filter: b => b.monthlyCost <= 60
    },
    multi: {
      name: '要多模态', icon: '◈',
      desc: '只看套餐含图像/视频/语音的组合',
      w: { coding: 7, value: 7, flex: 9, cn: 8, ci: 7, test: 8, ease: 5 },
      filter: b => {
        const pl = PLANS.find(x => x.id === b.plan);
        return pl && (pl.form === 'token' || pl.form === 'agent');
      }
    },
    test: {
      name: '测试导向', icon: '◇',
      desc: '按测试适配度排序，不筛',
      w: { coding: 7, value: 7, flex: 8, cn: 8, ci: 9, test: 10, ease: 5 },
      filter: () => true
    }
  };

  function bundleScore(b, w) {
    let s = 0, tot = 0;
    Object.entries(w).forEach(([k, v]) => {
      if (!v) return;
      s += v * ((b.s && b.s[k]) || 0);
      tot += v;
    });
    return tot ? s / tot : 0;
  }

  function renderBundles() {
    const cnt = $('#bundleCount');
    if (cnt) cnt.textContent = BUNDLES.length;
    const nav = $('#cntBundles');
    if (nav) nav.textContent = BUNDLES.length;

    const pr = $('#bPresets');
    if (pr) {
      pr.innerHTML = Object.entries(BUNDLE_PROFILES).map(([id, p]) =>
        `<button class="preset ${id === state.bundleProfile ? 'on' : ''}" data-bp="${esc(id)}">${p.icon} ${esc(p.name)}</button>`
      ).join('');
      $$('#bPresets .preset').forEach(btn => btn.onclick = () => {
        state.bundleProfile = btn.dataset.bp;
        renderBundles();
      });
    }

    const prof = BUNDLE_PROFILES[state.bundleProfile] || BUNDLE_PROFILES.all;
    const pool = BUNDLES.filter(prof.filter);
    const scored = pool.map(b => ({ b, s: bundleScore(b, prof.w) })).sort((x, y) => y.s - x.s);
    const dropped = BUNDLES.length - pool.length;

    const sub = $('#bSub');
    if (sub) {
      sub.innerHTML = `当前「${esc(prof.name)}」：${esc(prof.desc)}`
        + `<br>入选 <b>${scored.length}</b> 套`
        + (dropped ? `，已排除 ${dropped} 套不满足条件的` : '')
        + `　·　成本口径：开源壳算 ¥0，只算套餐价`;
    }

    const grid = $('#bGrid');
    if (!grid) return;
    if (!scored.length) {
      grid.innerHTML = '<div class="empty">这个条件下没有匹配的组合。换个筛选试试。</div>';
      return;
    }

    const DIM = [
      { k: 'coding', n: '编码能力' },
      { k: 'value', n: '性价比' },
      { k: 'flex', n: '灵活性' },
      { k: 'cn', n: '国内体验' },
      { k: 'ci', n: 'CI 友好' },
      { k: 'test', n: '测试适配' },
      { k: 'ease', n: '上手难度' }
    ];

    grid.innerHTML = scored.map((x, i) => {
      const b = x.b;
      const pct = rnd(x.s / 10 * 100);
      const bars = DIM.map(d => {
        const v = (b.s && b.s[d.k]) || 0;
        return `<div class="sb"><div class="n">${esc(d.n)}</div>
          <div class="t"><i style="width:${v * 10}%;background:${barGrad(v / 2)}"></i></div>
          <div class="v">${v.toFixed(1)}</div></div>`;
      }).join('');

      return `<div class="bcard ${i === 0 ? 'top' : ''}">
        <div class="bhead">
          <div>
            <div class="btitle">${esc(b.title)}</div>
            <div class="bname">${esc(b.name)}</div>
          </div>
          <div class="bscore"><div class="n">${pct}</div><div class="c">score</div></div>
          ${favBtn('bundle', b.id, b.name)}
        </div>
        <div class="bcost">¥${esc(b.monthlyCost)}<small>/ 月</small>
          <span class="bform">${esc(b.planForm || '')}</span>
        </div>
        <div class="bmini">${esc(b.costBasis || '')}</div>
        <div class="bsum">${esc(b.summary)}</div>
        <div class="bbars">${bars}</div>
        <div class="btags">${(b.tags || []).map(t => `<span class="tag c">${esc(t)}</span>`).join('')}</div>
        <div class="bwatch">! ${esc(b.watch)}</div>
        <div class="bfit"><b>适合：</b>${esc(b.fit)}</div>
        <details class="bmore">
          <summary>为什么这么搭${(b.why || []).length ? ' · ' + b.why.length + ' 条理由' : ''}</summary>
          <ul class="ul">${(b.why || []).map(w => `<li>${esc(w)}</li>`).join('')}</ul>
        </details>
      </div>`;
    }).join('');

    // 展开时同列卡片会被撑高，让 grid 自己排就行，不需要额外处理
    $$('#bGrid .bmore').forEach(d => {
      d.addEventListener('toggle', () => { /* 只为了让 transition 生效，无需动作 */ });
    });
  }

  /* =========================================================
     QUOTA CALCULATOR
     ---------------------------------------------------------
     各家的额度单位不能换算（请求次数 / Credits / AFP / 共享池），
     所以这里不假装能精确算，而是估出「你大概需要多少」，再按
     每家自己的口径折算出「大概够不够」。三档结论，不给假精确。
     ========================================================= */
  const CALC = { hours: 4, turns: 12, ctx: 2.5, batch: 20 };

  /* 一轮对话的 token 消耗基准（输入 + 输出，含工具调用往返）
     这些数字来自实际使用体感，不是官方数据 */
  const TOK_PER_TURN = { base: 9000, ctxFactor: 1 };

  function calcTokens() {
    const turnsPerDay = CALC.hours * CALC.turns;
    const perTurn = TOK_PER_TURN.base * CALC.ctx;
    // 批量任务上下文重复读，单价更高
    const batchMul = 1 + (CALC.batch / 100) * 0.6;
    const perDay = turnsPerDay * perTurn * batchMul;
    const perMonth = perDay * 22; // 按每月 22 个工作日
    return { turnsPerDay, perTurn, perDay, perMonth };
  }

  /* 每家套餐的额度折算。basis 写清楚这个数字是怎么来的 */
  const QUOTA_MODEL = {
    volc: {
      monthly: 18000, unit: '次请求', perTurn: 1,
      note: 'Lite 档每月 18,000 次请求（官方口径）',
      how: '按 1 轮 ≈ 1 次请求估；实际复杂任务会消耗 5–30 次，所以这里偏乐观'
    },
    huoshan_pro: {
      monthly: 90000, unit: '次请求', perTurn: 1,
      note: 'Pro 档每月 90,000 次请求',
      how: '同 Lite，按 1 轮 ≈ 1 次请求估'
    },
    glm: {
      monthly: 43000000, unit: 'tokens', perTurn: 1,
      note: 'Lite 每周 10,000 积分，约合每月 0.43–0.87 亿 tokens',
      how: '取区间下限 4300 万 tokens/月（缓存命中率低时的保守值）'
    },
    glm_pro: {
      monthly: 258000000, unit: 'tokens', perTurn: 1,
      note: 'Pro 档约为 Lite 的 6 倍',
      how: '按 Lite 的 6 倍折算'
    },
    bailian: {
      monthly: 11500, unit: 'Credits', perTurn: 1,
      note: 'Lite 档 11,500 Credits / 订阅月',
      how: 'Credits 按模型和 token 加权扣减，这里按 1 Credit ≈ 3,000 tokens 粗估'
    },
    minimax: {
      monthly: 20000000, unit: 'tokens', perTurn: 1,
      note: 'Go 档额度未公开具体数值',
      how: '按官方「3–4 个 Agent 用量」的表述反推，估算值仅供参考'
    },
    mimo: {
      monthly: 4100000000, unit: 'Credits', perTurn: 1,
      note: 'Lite 档 492 亿 Credits / 年 ≈ 41 亿 / 月',
      how: 'mimo-v2.6-flash 未命中缓存输入 100 Credits/token，折算约 4000 万 tokens/月'
    },
    kimip: {
      monthly: 26000000, unit: 'tokens', perTurn: 1,
      note: '与 Kimi 会员共享月度额度池（Pro 约 2600 万 tokens）',
      how: 'Plus 档额度约为 Pro 的一半，此处按 1300 万 tokens/月估'
    },
    qoder: {
      monthly: 2000, unit: 'Credits', perTurn: 1,
      note: '专业版 2,000 Credits / 月',
      how: 'Credits 与 token 的换算官方未公开，按 1 Credit ≈ 8,000 tokens 粗估'
    },
    dsapi: {
      monthly: Infinity, unit: '按量', perTurn: 1,
      note: '无月度上限，按实际 token 计费',
      how: '不受额度限制，只受预算限制'
    },
    ark_agent: {
      monthly: 20000, unit: 'AFP', perTurn: 1,
      note: 'Small 档 20,000 AFP 积分',
      how: 'AFP 会按模型档位和上下文长度折算，>128k 上下文有 7.5× 倍率'
    },
    mm_build: {
      monthly: 240000000, unit: 'tokens', perTurn: 1,
      note: 'Build 档为 Go 的 12 倍用量',
      how: '按 Go 的 12 倍折算'
    }
  };

  /* DeepSeek API 按量：估算月费 */
  function dsapiCost(tokens) {
    // 闲时/高峰混合，缓存命中率按 60% 估
    const inMiss = tokens * 0.4, inHit = tokens * 0.6, out = tokens * 0.25;
    // 元/百万 token，取高峰价（保守）
    const cost = (inMiss / 1e6) * 2 + (inHit / 1e6) * 0.04 + (out / 1e6) * 8;
    return cost;
  }

  function renderCalc() {
    const hv = $('#calcHoursV'), tv = $('#calcTurnsV'), bv = $('#calcBatchV');
    if (hv) hv.textContent = CALC.hours + ' 小时';
    if (tv) tv.textContent = CALC.turns + ' 轮';
    if (bv) bv.textContent = CALC.batch + '%';

    const out = $('#calcOut');
    if (!out) return;

    const t = calcTokens();
    const needPerMonth = t.perMonth;

    const rows = [];
    PLANS.forEach(p => {
      const m = QUOTA_MODEL[p.id];
      if (!m) return;
      let ratio, verdict, detail, cls;

      if (m.unit === '按量') {
        const cost = dsapiCost(needPerMonth);
        ratio = Infinity;
        verdict = '¥' + cost.toFixed(0) + '/月';
        cls = cost > 300 ? 'warn' : 'ok';
        detail = `无上限，估算花费 ¥${cost.toFixed(0)}（按高峰价、60% 缓存命中估）`;
      } else {
        // 把「需要多少 token」折算成该套餐的单位
        let need;
        if (m.unit === '次请求') need = t.turnsPerDay * 22;
        else if (m.unit === 'Credits' && p.id === 'mimo') need = needPerMonth / 4000; // 100 Credits/token 折算
        else if (m.unit === 'Credits' && p.id === 'bailian') need = needPerMonth / 3000;
        else if (m.unit === 'Credits' && p.id === 'qoder') need = needPerMonth / 8000;
        else if (m.unit === 'AFP') need = needPerMonth / 3000;
        else need = needPerMonth;

        ratio = need / m.monthly;
        if (ratio <= 0.6) { verdict = '够用'; cls = 'ok'; }
        else if (ratio <= 1.1) { verdict = '刚好'; cls = 'warn'; }
        else { verdict = '不够'; cls = 'bad'; }
        const pct = Math.round(ratio * 100);
        detail = `约需 ${fmtNum(need)} ${m.unit}，额度 ${fmtNum(m.monthly)} → 占用 ${pct}%`;
      }

      rows.push({ p, m, verdict, detail, cls, ratio });
    });

    rows.sort((a, b) => (a.ratio || 0) - (b.ratio || 0));

    out.innerHTML = `
      <div class="calcSummary">
        <div class="cs"><div class="k">每天轮数</div><div class="v">${t.turnsPerDay}<small> 轮</small></div></div>
        <div class="cs"><div class="k">每轮 token</div><div class="v">${fmtNum(t.perTurn)}</div></div>
        <div class="cs"><div class="k">每天 token</div><div class="v">${fmtNum(t.perDay)}</div></div>
        <div class="cs"><div class="k">每月 token（22 天）</div><div class="v" style="color:var(--cyan-t)">${fmtNum(needPerMonth)}</div></div>
      </div>
      <div class="calcList">
        ${rows.map(r => `
          <div class="crow ${r.cls}">
            <div class="cn">${esc(r.p.name)} ${esc(r.p.tier)}<small>¥${esc(r.p.price)}/月 · ${esc(r.p.formName || '')}</small></div>
            <div class="cv">${esc(r.verdict)}</div>
            <div class="cd">${esc(r.detail)}<br><span style="color:var(--dim2);font-size:var(--fs-1)">${esc(r.m.note)}</span></div>
          </div>`).join('')}
      </div>
      <div class="note warn" style="margin-top:16px">
        <b>这只是估算，别当精确值。</b>各家的额度单位（请求次数 / Credits / AFP / 共享池）根本无法互相换算，
        这里只能按「你自己填的用法」粗算。真正的答案只有一个办法拿到：<b>买最便宜的一档，用两周真实工作流压一遍</b>，
        记下每天撞几次额度。那比任何计算器都准。
      </div>`;

    // 绑定
    const bind = (id, key, fmt) => {
      const el = $('#' + id);
      if (!el) return;
      el.value = CALC[key];
      el.oninput = () => { CALC[key] = +el.value; renderCalc(); };
    };
    bind('calcHours', 'hours');
    bind('calcTurns', 'turns');
    bind('calcBatch', 'batch');
    const cs = $('#calcCtx');
    if (cs) {
      cs.value = String(CALC.ctx);
      cs.onchange = () => { CALC.ctx = +cs.value; renderCalc(); };
    }
  }

  function fmtNum(n) {
    if (!isFinite(n)) return '∞';
    if (n >= 1e8) return (n / 1e8).toFixed(2) + ' 亿';
    if (n >= 1e4) return (n / 1e4).toFixed(1) + ' 万';
    return String(Math.round(n));
  }

  /* =========================================================
     AI TEST
  /* =========================================================
     PROMOS · 优惠与免费额度
     ========================================================= */
  const PROMO_VALUE_CLASS = { '高': 'v-high', '中': 'v-mid', '低': 'v-low', '无': 'v-none' };

  function renderPromos() {
    const I = PR.intro || {};

    const kick = $('#prKick'); if (kick) kick.textContent = I.kick || 'Promos & Free Tier';
    const tt = $('#prTitle'); if (tt) tt.textContent = I.title || '免费额度、首购优惠与省钱时段';
    const ld = $('#prLede'); if (ld) ld.textContent = I.lede || '';

    const warn = $('#prWarn');
    if (warn) { warn.innerHTML = '⏳ <b>时效提醒</b>　' + esc(I.warn || ''); }

    const st = $('#prStats');
    if (st) {
      st.innerHTML = (PR.stats || []).map(s =>
        `<div class="stat"><div class="k">${esc(s.k)}</div>
         <div class="v" style="color:var(--${s.tone === 'green' ? 'c4' : s.tone + '-t'})">${esc(s.v)}</div>
         <div class="d">${esc(s.d)}</div></div>`).join('');
    }

    /* ---- 免费额度：类别筛选 ---- */
    const FT_CATS = [
      { id: 'all', name: '全部', icon: '◎' },
      { id: 'model', name: '模型 API', icon: '⌨' },
      { id: 'agent', name: 'Agent 产品', icon: '◈' }
    ];
    const ff = $('#ftFilter');
    if (ff) {
      const cnt = {};
      (PR.freeTier || []).forEach(f => cnt[f.cat || 'model'] = (cnt[f.cat || 'model'] || 0) + 1);
      ff.innerHTML = FT_CATS.map(c => {
        const n = c.id === 'all' ? (PR.freeTier || []).length : (cnt[c.id] || 0);
        return `<button class="preset ${state.ftCat === c.id ? 'on' : ''}" data-ft="${c.id}">${c.icon} ${c.name} ${n}</button>`;
      }).join('');
      $$('#ftFilter .preset').forEach(b => b.onclick = () => {
        state.ftCat = b.dataset.ft;
        renderPromos();
      });
    }

    /* ---- 免费额度卡片 ---- */
    const ft = $('#ftGrid');
    if (ft) {
      const list = (PR.freeTier || []).filter(f => state.ftCat === 'all' || (f.cat || 'model') === state.ftCat);
      if (!list.length) { ft.innerHTML = '<div class="empty">这个类别下还没有记录</div>'; }
      else ft.innerHTML = list.map(f => {
        const vc = PROMO_VALUE_CLASS[f.value] || 'v-none';
        const catName = f.cat === 'agent' ? 'Agent 产品' : '模型 API';
        const srcName = f.src === 'official' ? '官方口径' : '社区口径';
        const srcCls = f.src === 'official' ? 'src-off' : 'src-com';
        return `<div class="ftcard ${vc}">
          <div class="fthead">
            <div>
              <div class="ftvendor">${esc(f.vendor)}</div>
              <div class="ftbrand">${esc(f.brand)}</div>
            </div>
            <span class="ftv ${vc}">${esc(f.value)}价值</span>
          </div>
          <div class="fttags">
            <span class="ftcat ${f.cat === 'agent' ? 'c-agent' : 'c-model'}">${esc(catName)}</span>
            <span class="ftsrc ${srcCls}" title="${f.src === 'official' ? '官方文档或活动页能直接对上' : '来自社区汇总，官方未找到长期承诺'}">${esc(srcName)}</span>
          </div>
          <div class="ftwhat">${esc(f.what)}</div>
          <div class="ftrow"><b>怎么拿</b>${esc(f.how)}</div>
          <div class="ftrow"><b>限制</b>${esc(f.cap)}</div>
          <div class="fttrap"><b>坑在哪</b>${esc(f.trap)}</div>
          <div class="ftfoot">
            <span>核验 ${esc(f.verified)}</span>
            ${f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">官方说明 ↗</a>` : '<span>无公开链接</span>'}
          </div>
        </div>`;
      }).join('');
    }

    /* ---- 首购表 ---- */
    const tb = $('#fbTable');
    if (tb) {
      const rows = (PR.firstBuy || []).slice().map(b => {
        const off = (1 - b.promo / b.list) * 100;
        const cls = off >= 50 ? 'big' : off >= 10 ? 'mid' : 'small';
        const lab = off <= 0.5 ? '无折' : '−' + Math.round(off) + '%';
        return `<tr>
          <td><b>${esc(b.name)}</b></td>
          <td class="list-price">¥${b.list}</td>
          <td class="promo-price">¥${b.promo.toFixed(b.promo % 1 ? 1 : 0)}<span class="poff ${cls}">${lab}</span></td>
          <td>${esc(b.promoNote)}</td>
          <td style="color:var(--amber-t);font-size:var(--fs-1)">${esc(b.period)}</td>
          <td>${esc(b.after)}</td>
          <td style="font-size:var(--fs-1);color:var(--dim2)">${esc(b.stack)}</td>
          <td style="font-size:var(--fs-2)">${esc(b.judge)}</td>
        </tr>`;
      }).join('');
      tb.innerHTML = `<thead><tr>
          <th>套餐</th><th>标准月付</th><th>最低首购</th><th>优惠条件</th>
          <th>截止</th><th>到期后</th><th>可否叠加</th><th>我的判断</th>
        </tr></thead><tbody>${rows}</tbody>`;
    }

    /* ---- 四层叠加 ---- */
    const sl = $('#prStack');
    if (sl) {
      sl.innerHTML = (PR.stacking || []).slice()
        .sort((a, b) => a.level - b.level)
        .map(s => `<div class="slayer t-${esc(s.tone)}">
          <div class="slv">L${esc(String(s.level))}</div>
          <div>
            <div class="slt">${esc(s.title)}</div>
            <p class="slb">${esc(s.body)}</p>
          </div>
        </div>`).join('');
    }

    /* ---- 时段优惠 ---- */
    const og = $('#offGrid');
    if (og) {
      og.innerHTML = (PR.offpeak || []).map(o => {
        const zero = /不省|省心/.test(o.save);
        return `<div class="offcard">
          <div class="offtop">
            <div class="offn">${esc(o.name)}</div>
            <span class="offsave ${zero ? 'zero' : ''}">${esc(o.save)}</span>
          </div>
          <div class="offwin">🕐 ${esc(o.window)}</div>
          <div class="offrule">${esc(o.rule)}</div>
          <div class="offnote">${esc(o.note)}</div>
        </div>`;
      }).join('');
    }

    /* ---- 判断 ---- */
    const jd = $('#prJudges');
    if (jd) {
      jd.innerHTML = `<div class="opJudge">${(PR.judgments || []).map(j => `
        <div class="opJ">
          <div class="opJn">${esc(j.n)}</div>
          <div>
            <div class="opJt">${esc(j.title)}</div>
            <p class="opJb">${esc(j.body)}</p>
            <div class="opJa"><b>怎么做</b>${esc(j.action)}</div>
            <div class="opJx"><b>这条什么时候不成立</b>${esc(j.controversy)}</div>
          </div>
        </div>`).join('')}</div>`;
    }

    const cv = $('#prCaveats');
    if (cv) cv.innerHTML = (PR.caveats || []).map(c => `<li>${esc(c)}</li>`).join('');
  }

  /* =========================================================
     AI TEST · 测试向工具专项
     ========================================================= */
  const MATURITY = {
    stable: { name: '可用', color: '#4ade80', desc: '已经在真实项目里能用了' },
    beta: { name: '可用但有限', color: '#ffc857', desc: '能用，但边界场景要人盯' },
    experimental: { name: '实验', color: '#ff7a8a', desc: '别放进生产流水线' }
  };

  function renderAitest() {
    const allItems = [];
    (AT.groups || []).forEach(g => (g.items || []).forEach(it => allItems.push(it)));

    const cnt = $('#atCount');
    if (cnt) cnt.textContent = allItems.length + ' 个工具';
    const dis = $('#atDisclaimer');
    if (dis) dis.textContent = AT.disclaimer || '';

    const wrap = $('#atGroups');
    if (wrap) {
      wrap.innerHTML = (AT.groups || []).map(g => `
        <div class="panel">
          <h3><span class="ic">${esc(g.icon)}</span>${esc(g.name)}
            <span class="tag c" style="margin-left:6px;font-size:var(--fs-1)">${g.items.length} 个</span>
          </h3>
          <div class="sub">${esc(g.desc)}</div>
          <div class="atgrid">
            ${g.items.map(it => {
              const M = MATURITY[it.maturity] || MATURITY.experimental;
              return `<div class="atcard">
                <div class="ath">
                  <div>
                    <div class="atn">${esc(it.name)}</div>
                    <div class="atv">${esc(it.vendor)} · ${esc(it.license)}</div>
                  </div>
                  <div class="atm" style="background:${M.color}22;color:${M.color};border-color:${M.color}55"
                       title="${esc(M.desc)}">${esc(M.name)}</div>
                </div>
                <div class="atwhat">${esc(it.what)}</div>
                <div class="atpos">📍 ${esc(it.pos)}</div>
                <div class="atcols">
                  <div><div class="ath2 good">✓ 好在哪</div>
                    <ul class="ul good">${it.good.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
                  <div><div class="ath2 bad">✕ 差在哪</div>
                    <ul class="ul bad">${it.bad.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
                </div>
                <details class="atmore">
                  <summary>为什么值得用 · 怎么用</summary>
                  <div class="atwhy"><b>为什么值得用</b>${esc(it.why)}</div>
                  <div class="athow"><b>怎么用</b>${esc(it.how)}</div>
                </details>
                <div class="atfoot">
                  <span class="mini">成本：${esc(it.cost)}</span>
                  ${it.link ? `<a class="btn sm" href="${esc(it.link)}" target="_blank" rel="noopener">官网 ↗</a>` : ''}
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>`).join('');
    }

    const mn = $('#atMatrixNote');
    if (mn && AT.matrix) mn.textContent = AT.matrix.note || '';

    const mx = $('#atMatrix');
    if (mx && AT.matrix) {
      mx.innerHTML = (AT.matrix.rows || []).map(r => `
        <div class="atmrow">
          <div class="atmp">${esc(r.phase)}</div>
          <div class="atmb">
            <div class="atmline"><span class="lbl use">该用</span>${(r.use || []).map(x => `<span class="tag c">${esc(x)}</span>`).join('')}</div>
            <div class="atmline"><span class="lbl skip">先别碰</span>${(r.skip || []).map(x => `<span class="tag r">${esc(x)}</span>`).join('')}</div>
            <div class="atmwhy">${esc(r.why)}</div>
          </div>
        </div>`).join('');
    }

    const jd = $('#atJudgments');
    if (jd) {
      jd.innerHTML = (AT.judgments || []).map((j, i) =>
        `<li><b>${i + 1}. ${esc(j.title)}</b><br>${esc(j.body)}</li>`).join('');
    }
  }

  /* =========================================================
     EVENTS (市场变动 + 价格轨迹)
     ========================================================= */
  function renderEvents() {
    const cnt = $('#evCount');
    if (cnt) cnt.textContent = EV.events.length + ' 条记录';

    const note = $('#evNote');
    if (note) note.textContent = EV.note || '';

    // 类型筛选
    const kinds = EV.kinds || {};
    const used = {};
    EV.events.forEach(e => used[e.kind] = (used[e.kind] || 0) + 1);

    const fl = $('#evFilter');
    if (fl) {
      fl.innerHTML = `<button class="preset ${state.evKind === 'all' ? 'on' : ''}" data-ek="all">全部 ${EV.events.length}</button>`
        + Object.entries(used).map(([k, n]) => {
          const K = kinds[k] || { name: k, icon: '·', color: '#8a99b6' };
          return `<button class="preset ${state.evKind === k ? 'on' : ''}" data-ek="${esc(k)}">${K.icon} ${esc(K.name)} ${n}</button>`;
        }).join('');
      $$('#evFilter .preset').forEach(b => b.onclick = () => {
        state.evKind = b.dataset.ek;
        renderEvents();
      });
    }

    const list = EV.events
      .filter(e => state.evKind === 'all' || e.kind === state.evKind)
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    const line = $('#evLine');
    if (line) {
      if (!list.length) { line.innerHTML = '<div class="empty">这个类型下没有记录</div>'; }
      else {
        line.innerHTML = list.map(e => {
          const K = kinds[e.kind] || { name: e.kind, icon: '·', color: '#8a99b6' };
          const pl = PLANS.find(p => p.id === e.planId);
          return `<div class="evitem">
            <div class="evd">${esc(e.date)}</div>
            <div class="evdot" style="background:${K.color};box-shadow:0 0 0 3px ${K.color}22"></div>
            <div class="evb">
              <div class="evh">
                <span class="evk" style="background:${K.color}18;color:${K.color};border-color:${K.color}44">${K.icon} ${esc(K.name)}</span>
                <span class="evt">${esc(e.title)}</span>
              </div>
              <div class="evx">${esc(e.body)}</div>
              ${e.impact ? `<div class="evi">→ ${esc(e.impact)}</div>` : ''}
              <div class="evf">
                ${pl ? `<span class="tag c" style="font-size:var(--fs-1)">${esc(pl.name)} ${esc(pl.tier)}</span>` : ''}
                ${e.source ? `<a href="${esc(e.source)}" target="_blank" rel="noopener" class="mini">官方来源 ↗</a>` : ''}
              </div>
            </div>
          </div>`;
        }).join('');
      }
    }

    // 价格轨迹
    const sw = $('#sparkWrap');
    if (sw) {
      const withTrend = PLANS.filter(p => (p.historyPoints || 0) >= 2);
      const single = PLANS.filter(p => (p.historyPoints || 0) < 2);

      sw.innerHTML = withTrend.map(p => sparkCard(p)).join('')
        + (single.length ? `<div class="sparknote">
            <b>只有单点记录（画不出趋势）：</b>${single.map(p => esc(p.name + ' ' + p.tier)).join('、')}
          </div>` : '');
    }

    const lim = $('#evLimits');
    if (lim) {
      lim.innerHTML = `
        <li><b>这不是完整的市场史。</b>只记录我确认过的变动，价格没变不代表没变过——只是我没查到确证。</li>
        <li><b>首月价、活动价不算变动。</b>本表统一按标准月付价记录，¥9.9、¥7.9 这类入口价写在备注里。</li>
        <li><b>额度调整没进时间轴。</b>很多涨价是「价格不变但额度缩水」，这种没有公开数据，查不到就不写。</li>
        <li><b>事件日期取公告日或核验日。</b>部分官方公告只给了月份，日期是近似值。</li>`;
    }
  }

  /* 单条价格轨迹卡：用 SVG 折线，不引第三方库 */
  function sparkCard(p) {
    const h = (p.history || []).filter(x => x.price > 0);
    if (h.length < 2) return '';

    const W = 300, H = 78, PAD = 10;
    const prices = h.map(x => x.price);
    const min = Math.min(...prices), max = Math.max(...prices);
    const range = max - min || 1;
    const stepX = (W - PAD * 2) / (h.length - 1);

    const pts = h.map((x, i) => {
      const px = PAD + i * stepX;
      const py = H - PAD - ((x.price - min) / range) * (H - PAD * 2);
      return { x: px, y: py, d: x };
    });

    const path = pts.map((pt, i) => (i ? 'L' : 'M') + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1)).join(' ');
    const area = path + ` L${pts[pts.length - 1].x.toFixed(1)} ${H - PAD} L${pts[0].x.toFixed(1)} ${H - PAD} Z`;

    const rising = prices[prices.length - 1] > prices[0];
    const falling = prices[prices.length - 1] < prices[0];
    const color = rising ? 'var(--c3)' : falling ? 'var(--c4)' : 'var(--c6)';
    const gid = 'g_' + p.id;

    const dots = pts.map(pt => `<circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="3" fill="${color}" stroke="#0c1119" stroke-width="1.5"><title>${esc(pt.d.date)} · ¥${pt.d.price} · ${esc(pt.d.note || '')}</title></circle>`).join('');

    const last = prices[prices.length - 1];
    const first = prices[0];
    const pct = first ? Math.round((last - first) / first * 1000) / 10 : 0;
    const pctTxt = pct === 0 ? '持平' : (pct > 0 ? '+' : '') + pct + '%';

    return `<div class="spark">
      <div class="sparkh">
        <div>
          <div class="sparkn">${esc(p.name)} ${esc(p.tier)}</div>
          <div class="sparkm">${h.length} 个数据点 · 当前 ¥${last}</div>
        </div>
        <div class="sparkp" style="color:${color}">${esc(pctTxt)}</div>
      </div>
      <svg viewBox="0 0 ${W} ${H}" class="sparksvg" preserveAspectRatio="none">
        <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity=".28"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient></defs>
        <path d="${area}" fill="url(#${gid})"/>
        <path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        ${dots}
      </svg>
      <div class="sparkx">${h.map(x => `<span title="${esc(x.note || '')}">${esc(x.date.slice(2))}</span>`).join(' → ')}</div>
    </div>`;
  }

  /* =========================================================
     VERSUS
     ========================================================= */
  const VS_PRESETS = [
    { n: 'DSH vs Claude Code', a: 'dsh', b: 'cc' },
    { n: 'DSH vs Codex', a: 'dsh', b: 'codex' },
    { n: 'Claude Code vs Codex', a: 'cc', b: 'codex' },
    { n: 'ZCode vs Qoder', a: 'zcode', b: 'qcode' },
    { n: 'Kimi Code vs MiniMax Code', a: 'kimicode', b: 'mmcode' },
    { n: 'Pi vs Hermes', a: 'pi', b: 'hermes' }
  ];

  function renderVersus() {
    const sa = $('#vsA'), sb = $('#vsB');
    if (!sa || !sb) return;

    const opts = TOOLS.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');
    if (!sa.dataset.built) {
      sa.innerHTML = opts;
      sb.innerHTML = opts;
      sa.dataset.built = '1';
      sa.value = state.vsA;
      sb.value = state.vsB;
      sa.onchange = () => { state.vsA = sa.value; renderVersus(); };
      sb.onchange = () => { state.vsB = sb.value; renderVersus(); };
    }

    const pr = $('#vsPresets');
    if (pr) {
      pr.innerHTML = VS_PRESETS.map(p =>
        `<button class="preset ${state.vsA === p.a && state.vsB === p.b ? 'on' : ''}" data-a="${esc(p.a)}" data-b="${esc(p.b)}">${esc(p.n)}</button>`
      ).join('');
      $$('#vsPresets .preset').forEach(btn => btn.onclick = () => {
        state.vsA = btn.dataset.a;
        state.vsB = btn.dataset.b;
        sa.value = state.vsA; sb.value = state.vsB;
        renderVersus();
      });
    }

    const A = TOOLS.find(t => t.id === state.vsA) || TOOLS[0];
    const B = TOOLS.find(t => t.id === state.vsB) || TOOLS[1];
    if (!A || !B) return;

    const sub = $('#vsSub');
    if (sub) {
      sub.innerHTML = A.id === B.id
        ? '<span style="color:var(--c3)">两边选的是同一款，换个对手。</span>'
        : `对比 <b>${esc(A.name)}</b> 与 <b>${esc(B.name)}</b>。绿色 = 该维度领先 1 分以上，红色 = 落后 1 分以上。`;
    }

    // 九维对比
    const tb = $('#vsTable');
    if (tb) {
      let aWin = 0, bWin = 0, tie = 0;
      const rows = CRIT.criteria.map(c => {
        const va = A.score[c.id] || 0, vb = B.score[c.id] || 0;
        const d = va - vb;
        let clsA = '', clsB = '';
        if (d >= 1) { clsA = 'win'; clsB = 'lose'; aWin++; }
        else if (d <= -1) { clsA = 'lose'; clsB = 'win'; bWin++; }
        else tie++;
        return `<tr>
          <td class="vsn">${c.icon} ${esc(c.name)}<div class="mini">${esc(c.desc)}</div></td>
          <td class="vsv ${clsA}">${va}</td>
          <td class="vsbar">
            <div class="vsbwrap">
              <div class="vsbA" style="width:${va / 5 * 100}%"></div>
              <div class="vsbB" style="width:${vb / 5 * 100}%"></div>
            </div>
          </td>
          <td class="vsv ${clsB}">${vb}</td>
        </tr>`;
      }).join('');

      tb.innerHTML = `
        <div class="vshead">
          <div></div>
          <div class="vsh a" style="border-color:${A.grad.includes('#') ? '#5aa9ff' : '#2fe3d4'}">${esc(A.name)}</div>
          <div></div>
          <div class="vsh b">${esc(B.name)}</div>
        </div>
        <table class="vstb">
          <thead><tr><th>维度</th><th>${esc(A.letter)}</th><th></th><th>${esc(B.letter)}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="vsscore">
          <div class="vss a"><span class="n">${aWin}</span><span class="l">项领先</span></div>
          <div class="vss t"><span class="n">${tie}</span><span class="l">项持平</span></div>
          <div class="vss b"><span class="n">${bWin}</span><span class="l">项领先</span></div>
        </div>`;

      tb.dataset.wins = JSON.stringify({ a: aWin, b: bWin, tie });
    }

    // 能力明细
    const cv = $('#vsCaps');
    if (cv) {
      let aLead = 0, bLead = 0, same = 0;
      const groups = CAPS.groups.map(g => {
        const items = g.items.map(it => {
          const va = (A.capabilities || {})[it.id] || 0;
          const vb = (B.capabilities || {})[it.id] || 0;
          const d = va - vb;
          let mark = '', cls = '';
          if (d >= 2) { mark = '◀ 明显'; cls = 'a'; aLead++; }
          else if (d === 1) { mark = '◀'; cls = 'a'; aLead++; }
          else if (d <= -2) { mark = '明显 ▶'; cls = 'b'; bLead++; }
          else if (d === -1) { mark = '▶'; cls = 'b'; bLead++; }
          else { mark = '＝'; cls = ''; same++; }
          return `<div class="vcaprow">
            <div class="vcapn" title="${esc(it.desc)}">${esc(it.name)}</div>
            <div class="vcapv ${va > vb ? 'hi' : ''}">${va}</div>
            <div class="vcapm ${cls}">${mark}</div>
            <div class="vcapv ${vb > va ? 'hi' : ''}">${vb}</div>
          </div>`;
        }).join('');
        return `<div class="vcapg"><div class="vcapgh">${g.icon} ${esc(g.name)}</div>${items}</div>`;
      }).join('');
      cv.innerHTML = `<div class="vcapgrid">${groups}</div>
        <div class="vsscore" style="margin-top:14px">
          <div class="vss a"><span class="n">${aLead}</span><span class="l">项领先</span></div>
          <div class="vss t"><span class="n">${same}</span><span class="l">项持平</span></div>
          <div class="vss b"><span class="n">${bLead}</span><span class="l">项领先</span></div>
        </div>`;
    }

    // 结论
    const vd = $('#vsVerdict');
    if (vd) {
      if (A.id === B.id) {
        vd.innerHTML = '<div class="note">选了两款一样的工具。换个对手。</div>';
        return;
      }
      const w = state.weights;
      const sa2 = toolScore(A, w), sb2 = toolScore(B, w);
      const diff = sa2 - sb2;
      const lead = diff > 0 ? A : B;
      const behind = diff > 0 ? B : A;
      const gap = Math.abs(diff / 5 * 100);

      // 找差距最大的两维
      const dims = CRIT.criteria.map(c => ({
        c, d: (A.score[c.id] || 0) - (B.score[c.id] || 0), w: w[c.id] || 0
      })).filter(x => x.w > 0).sort((x, y) => Math.abs(y.d * y.w) - Math.abs(x.d * x.w));

      const why = dims.slice(0, 2).filter(x => x.d !== 0).map(x =>
        `${x.c.icon}${x.c.name} ${x.d > 0 ? esc(A.name) + ' 领先' : esc(B.name) + ' 领先'} ${Math.abs(x.d)} 分`
      ).join('，');

      const costs = `${A.name} ¥${A.monthlyCost}/月，${B.name} ¥${B.monthlyCost}/月`;

      vd.innerHTML = `
        <div class="vsconcl">
          <div class="vsc1">
            <div class="vk">在当前权重下</div>
            <div class="vn">${esc(lead.name)} 更强，领先 ${gap.toFixed(1)} 分</div>
            <div class="vx">${why ? '主要差在：' + why + '。' : '两者在这个权重下几乎打平。'}</div>
          </div>
          <div class="vsc2">
            <div class="vrow"><span>${esc(behind.name)} 的翻盘点</span><b>${esc(behind.name)} 月成本 ¥${behind.monthlyCost}</b></div>
            <div class="vx">${esc(costs)}。${A.cnDirect !== B.cnDirect ? (A.cnDirect ? A.name + ' 国内直连，' + B.name + ' 需要境外网络。' : B.name + ' 国内直连，' + A.name + ' 需要境外网络。') : ''}</div>
          </div>
        </div>
        <div class="note" style="margin-top:14px">
          <b>提醒：</b>这只是按当前权重算的。去「决策矩阵」把权重调成你自己的偏好，结论可能会翻转——
          比如把「国内可用性」拉到 10，Claude Code 会立刻掉下去。
        </div>`;
    }
  }

  /* =========================================================
     OPINION (我的判断)
     ---------------------------------------------------------
     这一页是回答「你怎么看待」。不是中立综述——中立综述没有价值，
     已经有太多对比表了。这里给的是有立场的判断，每条都标了边界
     （controversy 字段），因为一个不说边界的判断等于废话。
     ========================================================= */
  function renderOpinion() {
    const kick = $('#opKick'), title = $('#opTitle'), lede = $('#opLede'), body = $('#opBody');
    if (!body) return;
    if (kick) kick.textContent = OP.kick || 'What I Think';
    if (title) title.textContent = OP.title || '我的判断';
    if (lede) lede.textContent = OP.lede || '';

    const secs = OP.sections || [];
    const byId = {};
    secs.forEach(s => byId[s.id] = s);

    const out = [];

    // --- 三种活法 ---
    const land = byId.landscape;
    if (land) {
      out.push(`
        <div class="panel">
          <h2 class="opH2">${esc(land.title)}</h2>
          <div class="sub">${esc(land.lede)}</div>
          <div class="op3">
            ${land.cards.map(c => `
              <div class="opCard t-${esc(c.tone)}">
                <div class="opCl">${esc(c.label)}</div>
                <div class="opCt">${esc(c.title)}</div>
                <div class="opCm">${c.members.map(m => `<span class="tag">${esc(m)}</span>`).join('')}</div>
                <p class="opCb">${esc(c.body)}</p>
                <div class="opCr"><b>要说风险</b>${esc(c.risk)}</div>
              </div>`).join('')}
          </div>
        </div>`);
    }

    // --- 四个判断 ---
    const jd = byId.judgments;
    if (jd) {
      out.push(`
        <div class="panel">
          <h2 class="opH2">${esc(jd.title)}</h2>
          <div class="sub">${esc(jd.lede)}</div>
          <div class="opJudge">
            ${jd.items.map(it => `
              <div class="opJ">
                <div class="opJn">${esc(it.n)}</div>
                <div class="opJc">
                  <div class="opJt">${esc(it.title)}</div>
                  <p class="opJb">${esc(it.body)}</p>
                  <div class="opJa"><b>所以</b>${esc(it.action)}</div>
                  <div class="opJx"><b>这条不成立的情况</b>${esc(it.controversy)}</div>
                </div>
              </div>`).join('')}
          </div>
        </div>`);
    }

    // --- 只问一个问题 ---
    const pr = byId.principle;
    if (pr) {
      out.push(`
        <div class="panel">
          <h2 class="opH2">${esc(pr.title)}</h2>
          <div class="sub">${esc(pr.lede)}</div>
          <div class="opQ">${esc(pr.question)}</div>
          <div class="op2">
            <div class="opSide ${esc(pr.left.tone)}">
              <div class="opSt">${esc(pr.left.title)}</div>
              <p>${esc(pr.left.body)}</p>
              <div class="opSv">${esc(pr.left.verdict)}</div>
            </div>
            <div class="opSide ${esc(pr.right.tone)}">
              <div class="opSt">${esc(pr.right.title)}</div>
              <p>${esc(pr.right.body)}</p>
              <div class="opSv">${esc(pr.right.verdict)}</div>
            </div>
          </div>
          <div class="note good" style="margin-top:16px">${esc(pr.foot)}</div>
        </div>`);
    }

    // --- 信自己的体感 ---
    const tr = byId.trust;
    if (tr) {
      out.push(`
        <div class="panel">
          <h2 class="opH2">${esc(tr.title)}</h2>
          <div class="sub">${esc(tr.lede)}</div>
          <p class="opP">${esc(tr.body)}</p>
          <div class="note" style="margin-bottom:14px">${esc(tr.cost)}</div>
          <div class="opSteps">
            ${(tr.steps || []).map((s, i) => `<div class="opStep"><i>${i + 1}</i><span>${esc(s)}</span></div>`).join('')}
          </div>
        </div>`);
    }

    // --- 收尾 ---
    if (OP.closing) {
      const c = OP.closing;
      out.push(`
        <div class="opClose">
          <div class="opCk">${esc(c.title)}</div>
          <div class="opCb">${esc(c.body)}</div>
          <div class="opCp">${esc(c.punch)}</div>
          <div class="opCs">${esc(c.sig)}</div>
        </div>`);
    }

    body.innerHTML = out.join('');
  }

  /* =========================================================
     PERSONA (测试人诊断)
     ---------------------------------------------------------
     设计要点：
     1. 答完才显示结果，不做「边答边变」的实时反馈——那会诱导用户
        为了看到想要的类型而改答案。
     2. 分数并列时用固定优先级打破，保证结果稳定（同样的答案永远
        得到同样的类型）。
     3. 结果不只是「你是什么」，要给「下一步做什么」，并且直接链到
        对应的组合方案和成长阶段。
     ========================================================= */
  const PERSONA_ORDER = ['owl', 'octopus', 'beaver', 'fox', 'ant', 'lion', 'penguin', 'hamster'];

  function personaScores(answers) {
    const sc = {};
    PE.questions.forEach((q, qi) => {
      const o = q.options.find(x => x.id === answers[qi]);
      if (!o) return;
      Object.entries(o.scores || {}).forEach(([k, v]) => { sc[k] = (sc[k] || 0) + v; });
    });
    return sc;
  }

  function personaWinner(sc) {
    let best = null, bestScore = -1;
    // 先按分数，再按固定优先级，保证稳定
    Object.keys(PE.personas).forEach(k => {
      const s = sc[k] || 0;
      if (s > bestScore) { bestScore = s; best = k; }
      else if (s === bestScore && best) {
        const i = PERSONA_ORDER.indexOf(k), j = PERSONA_ORDER.indexOf(best);
        if (i >= 0 && (j < 0 || i < j)) best = k;
      }
    });
    return best;
  }

  function renderPersona() {
    const intro = $('#peIntro');
    if (intro) intro.textContent = PE.intro || '';
    const qc = $('#peQCount'); if (qc) qc.textContent = PE.questions.length;
    const pc = $('#pePCount'); if (pc) pc.textContent = Object.keys(PE.personas).length;

    // 恢复上次结果
    if (state.peDone && state.peAnswers.length === PE.questions.length) {
      renderPersonaResult();
      return;
    }
    renderPersonaQuestion();
  }

  function renderPersonaQuestion() {
    const quiz = $('#peQuiz'), res = $('#peResult');
    if (!quiz || !res) return;
    quiz.style.display = '';
    res.style.display = 'none';

    const i = state.peStep;
    const q = PE.questions[i];
    if (!q) { finishPersona(); return; }

    const fill = $('#peBarFill');
    if (fill) fill.style.width = ((i) / PE.questions.length * 100) + '%';
    const st = $('#peStep');
    if (st) st.textContent = `第 ${i + 1} / ${PE.questions.length} 题`;

    const qEl = $('#peQuestion');
    if (qEl) {
      qEl.innerHTML = `
        <div class="peQText">${esc(q.text)}</div>
        <div class="peQHint">${esc(q.hint || '')}</div>
        <div class="peOpts">
          ${q.options.map(o => {
            const on = state.peAnswers[i] === o.id;
            return `<button class="peOpt ${on ? 'on' : ''}" data-oid="${esc(o.id)}">
              <span class="peBox">${on ? '●' : '○'}</span>
              <span class="peLabel">${esc(o.label)}</span>
              <span class="peDesc">${esc(o.desc)}</span>
            </button>`;
          }).join('')}
        </div>`;
      $$('#peQuestion .peOpt').forEach(btn => btn.onclick = () => {
        state.peAnswers[i] = btn.dataset.oid;
        if (i < PE.questions.length - 1) {
          state.peStep = i + 1;
          renderPersonaQuestion();
        } else {
          finishPersona();
        }
      });
    }

    const prev = $('#pePrev');
    if (prev) {
      prev.disabled = i === 0;
      prev.style.opacity = i === 0 ? .4 : 1;
      prev.onclick = () => { if (i > 0) { state.peStep = i - 1; renderPersonaQuestion(); } };
    }
    const rs = $('#peRestart');
    if (rs) rs.onclick = resetPersona;
  }

  function finishPersona() {
    state.peDone = true;
    renderPersonaResult();
    syncHash();
  }

  function resetPersona() {
    state.peDone = false;
    state.peStep = 0;
    state.peAnswers = [];
    renderPersonaQuestion();
    syncHash();
    toast('已重置，重新开始');
  }

  function renderPersonaResult() {
    const quiz = $('#peQuiz'), res = $('#peResult');
    if (!quiz || !res) return;
    quiz.style.display = 'none';
    res.style.display = '';

    const sc = personaScores(state.peAnswers);
    const wid = personaWinner(sc);
    const P = PE.personas[wid];
    if (!P) { res.innerHTML = '<div class="empty">数据缺失</div>'; return; }

    // 第二名（只从有分的里挑）
    const scored = Object.entries(sc).filter(([, v]) => v > 0).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return PERSONA_ORDER.indexOf(a[0]) - PERSONA_ORDER.indexOf(b[0]);
    });
    const second = scored[1] ? PE.personas[scored[1][0]] : null;

    // 分布图要显示全部类别（含 0 分），否则看不出「哪些类型我完全没有」
    const allRanked = Object.keys(PE.personas).map(k => [k, sc[k] || 0]).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return PERSONA_ORDER.indexOf(a[0]) - PERSONA_ORDER.indexOf(b[0]);
    });
    const total = allRanked.reduce((a, x) => a + x[1], 0) || 1;

    const bundle = BUNDLES.find(b => b.id === P.bundle);
    const phase = (ROAD.phases || []).find(p => p.id === P.phase);
    const bundlePlan = bundle ? PLANS.find(p => p.id === bundle.plan) : null;

    res.innerHTML = `
      <div class="peResult">
        <div class="peHero">
          <div class="peEmoji">${esc(P.emoji)}</div>
          <div class="peHMain">
            <div class="peK">你的测试人类别 · ${esc(P.code)}</div>
            <div class="peName">${esc(P.name)}</div>
            <div class="peTag">${esc(P.tagline)}</div>
            <div class="peLevel">当前阶段：<b>${esc(P.level)}</b></div>
          </div>
          <div class="peHBadge">${esc(P.code)}</div>
        </div>

        <div class="panel">
          <h3><span class="ic">🪞</span>你现在的样子</h3>
          <div class="sub">${esc(PE.note || '')}</div>
          <p class="peProfile">${esc(P.profile)}</p>
          <div class="peSym">
            <div class="peSymH">典型症状（中了三条以上，说明分类准了）</div>
            <ul class="ul bad">${P.symptoms.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
          </div>
        </div>

        <div class="grid2">
          <div class="panel" style="margin-bottom:0">
            <h3><span class="ic">◎</span>第一步做什么</h3>
            <div class="note good" style="margin-bottom:12px">${esc(P.firstStep)}</div>
            <div class="pePit"><b>最容易踩的坑</b>${esc(P.pitfall)}</div>
          </div>
          <div class="panel" style="margin-bottom:0">
            <h3><span class="ic">◈</span>为什么是这套</h3>
            <p class="peWhy">${esc(P.why)}</p>
            ${bundle ? `
              <div class="peBundle">
                <div class="peBh">
                  <div>
                    <div class="peBt">${esc(bundle.title)}</div>
                    <div class="peBn">${esc(bundle.name)}</div>
                  </div>
                  <div class="peBp">¥${esc(bundle.monthlyCost)}<small>/月</small></div>
                </div>
                <div class="peBs">${esc(bundle.summary)}</div>
                <div class="peBtags">
                  ${(bundle.tags || []).map(t => `<span class="tag c">${esc(t)}</span>`).join('')}
                  ${bundlePlan ? `<span class="tag v">${esc(bundlePlan.formName || '')}</span>` : ''}
                </div>
                <div class="peBwatch">! ${esc(bundle.watch)}</div>
                <div class="peBlink">
                  <a class="btn sm" href="#bundles">看这套组合 →</a>
                  <a class="btn sm" href="#matrix">对比其他工具 →</a>
                </div>
              </div>` : ''}
            ${phase ? `
              <div class="pePhase">
                <span class="tag a">${esc(phase.code)} · ${esc(phase.span)}</span>
                <b>${esc(phase.title)}</b>
                <div class="mini">${esc(phase.goal)}</div>
                <a class="btn sm" href="#roadmap" style="margin-top:8px">看完整路线 →</a>
              </div>` : ''}
          </div>
        </div>

        <div class="panel">
          <h3><span class="ic">▦</span>你的倾向分布</h3>
          <div class="sub">不是你「混了八种」，而是这些类型的特征你或多或少都有。分数最高的那个是当前主要状态。</div>
          <div class="peDist">
            ${allRanked.map(([k, v]) => {
              const pp = PE.personas[k];
              if (!pp) return '';
              const pct = Math.round(v / total * 100);
              const isTop = k === wid;
              return `<div class="peBar2 ${isTop ? 'top' : ''}">
                <div class="peB2n">${esc(pp.emoji)} ${esc(pp.name)}</div>
                <div class="peB2t"><i style="width:${pct}%"></i></div>
                <div class="peB2v">${v} 分</div>
              </div>`;
            }).join('')}
          </div>
          ${second ? `<div class="note" style="margin-top:14px">
            <b>你可能也在「${esc(second.name)}」和「${esc(P.name)}」之间摇摆。</b>
            这两种状态的差别是：${esc(second.tagline)} vs ${esc(P.tagline)}。
            如果两边症状都对得上，说明你正在过渡期——按「${esc(P.name)}」的下一步做，会更顺着走。
          </div>` : ''}
        </div>

        <div class="panel">
          <h3><span class="ic">!</span>这个诊断的局限</h3>
          <ul class="ul bad">
            <li><b>4 道题不可能定义一个人。</b>它只是把你现在的处境归个类，方便你找到对应的建议。</li>
            <li><b>类别会变。</b>三个月后同样的题，你可能落到另一类——那是好事，说明你在动。</li>
            <li><b>没有「高级」和「低级」。</b>带队狮子和深夜猫头鹰只是分工不同，不是水平高低。</li>
            <li><b>别为了变成某一类去答题。</b>那只会让你拿到错误的建议。</li>
          </ul>
        </div>

        <div class="peActions">
          <button class="btn" id="peAgain">重新测一次</button>
          <a class="btn" href="#overview">回总览</a>
        </div>
      </div>`;

    const again = $('#peAgain');
    if (again) again.onclick = resetPersona;
  }

  /* =========================================================
     ROADMAP
     ========================================================= */
  function renderRoadmap() {
    const el = $('#phases');
    if (el) {
      el.innerHTML = (ROAD.phases || []).map(p => `
        <div class="phase">
          <div class="pt"><div class="pk">${esc(p.code)}</div><div class="pn">${esc(p.span)}</div></div>
          <div class="pc">
            <h5>${esc(p.title)}</h5>
            <div class="goal">目标：${esc(p.goal)}</div>
            <ul class="ul">${p.tasks.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
            <div class="pit">! ${esc(p.pitfall)}</div>
            <div class="outs">
              ${p.outputs.map(o => `<span class="tag c">${esc(o)}</span>`).join('')}
              ${p.skills.map(s => `<span class="tag v">${esc(s)}</span>`).join('')}
            </div>
            <div class="chk">${esc(p.checkpoint)}</div>
          </div>
        </div>`).join('');
    }

    const st = $('#stacks');
    if (st) {
      st.innerHTML = (ROAD.stacks || []).map(s => `
        <div class="sc" style="border:1px solid var(--line);border-radius:var(--r);padding:18px;background:var(--panel);position:relative">
          ${s.rec ? '<div style="position:absolute;top:0;right:0;background:linear-gradient(135deg,var(--cyan),var(--blue));color:#04121a;font-size:var(--fs-1);font-weight:700;padding:3px 10px;border-radius:0 var(--r) 0 10px">推荐</div>' : ''}
          <h4 style="margin:0 0 4px;font-size:var(--fs-3)">${esc(s.name)}</h4>
          <div style="font-size:var(--fs-6);font-weight:700;color:var(--amber-t);letter-spacing:-.6px">${esc(s.price)}<small style="font-size:var(--fs-1);color:var(--dim2);font-weight:600"> ${esc(s.unit)}</small></div>
          <ul class="ul" style="margin-top:10px">${s.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
          <div class="note" style="margin-top:10px;font-size:var(--fs-2)">${esc(s.weak)}</div>
        </div>`).join('');
    }

    const jd = $('#judgments');
    if (jd) {
      jd.innerHTML = (ROAD.judgments || []).map((j, i) => `
        <li><b>${i + 1}. ${esc(j.title)}</b><br>${esc(j.body)}</li>`).join('');
    }
  }

  /* =========================================================
     STACK BUILDER
     ========================================================= */
  /* 组合口径：开源壳（DSH / Pi / Hermes / MiMo）本身免费，钱花在"电"上。
     工具库里的 ¥60 是"自备 API 的参考花费"，两处必须分开，否则采纳组合后账面会比组合页多一份壳钱。 */
  function shellCost(t) {
    if (!t) return 0;
    return t.license === '闭源' ? (t.monthlyCost || 0) : 0;
  }

  function renderStack() {
    const tp = $('#stackTools');
    if (tp) {
      tp.innerHTML = TOOLS.map(t => `
        <div class="pk ${state.pickedTools.indexOf(t.id) >= 0 ? 'on' : ''}" data-t="${esc(t.id)}" role="checkbox" aria-checked="${state.pickedTools.indexOf(t.id) >= 0}" tabindex="0">
          <div class="bx" aria-hidden="true">✓</div>
          <div><div class="nm">${esc(t.name)}</div><div class="vv">${shellCost(t) ? '¥' + esc(t.monthlyCost) + '/月' : '¥0 · 开源壳'} · ${esc(t.license)}</div></div>
        </div>`).join('');
      $$('#stackTools .pk').forEach(el => {
        const toggle = () => {
          const id = el.dataset.t;
          const i = state.pickedTools.indexOf(id);
          if (i >= 0) state.pickedTools.splice(i, 1); else state.pickedTools.push(id);
          localStorage.setItem('ats_stack', JSON.stringify(state.pickedTools));
          renderStack();
        };
        el.onclick = toggle;
        el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } };
      });
    }

    const pp = $('#stackPlans');
    if (pp) {
      pp.innerHTML = PLANS.map(p => `
        <div class="pk ${state.pickedPlans.indexOf(p.id) >= 0 ? 'on' : ''}" data-p="${esc(p.id)}" role="checkbox" aria-checked="${state.pickedPlans.indexOf(p.id) >= 0}" tabindex="0">
          <div class="bx" aria-hidden="true">✓</div>
          <div><div class="nm">${esc(p.name)} ${esc(p.tier)}</div><div class="vv">¥${esc(p.price)}/月</div></div>
        </div>`).join('');
      $$('#stackPlans .pk').forEach(el => {
        const toggle = () => {
          const id = el.dataset.p;
          const i = state.pickedPlans.indexOf(id);
          if (i >= 0) state.pickedPlans.splice(i, 1);
          else state.pickedPlans = [id];
          localStorage.setItem('ats_picked', JSON.stringify(state.pickedPlans));
          renderStack();
          syncHash();
        };
        el.onclick = toggle;
        el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } };
      });
    }

    const tot = state.pickedTools.reduce((a, id) => {
      const t = TOOLS.find(x => x.id === id);
      return a + shellCost(t);
    }, 0) + state.pickedPlans.reduce((a, id) => {
      const p = PLANS.find(x => x.id === id);
      return a + (p ? p.price : 0);
    }, 0);

    const box = $('#stackTotal');
    if (box) {
      const tnames = state.pickedTools.map(id => (TOOLS.find(x => x.id === id) || {}).name).filter(Boolean);
      const pnames = state.pickedPlans.map(id => {
        const p = PLANS.find(x => x.id === id);
        return p ? p.name + ' ' + p.tier : '';
      }).filter(Boolean);

      // 覆盖度自检
      const picked = state.pickedTools.map(id => TOOLS.find(x => x.id === id)).filter(Boolean);
      const hasCli = picked.some(t => t.scriptable);
      const hasGui = picked.some(t => (t.capabilities || {}).gui >= 4);
      const hasCn = picked.some(t => t.cnDirect);
      const hasPlan = state.pickedPlans.length > 0;
      const checks = [
        { ok: picked.length > 0, txt: '至少选一个工具壳' },
        { ok: hasPlan, txt: '至少选一个模型供给（套餐 / API）' },
        { ok: hasCli, txt: '有一个可脚本化的壳（否则进不了 CI）' },
        { ok: hasCn, txt: '有一个国内直连（否则要解决网络）' }
      ];

      box.innerHTML = `
        <div><div class="lbl">月总成本</div><div class="big">¥${tot}</div></div>
        <div class="dd">
          <b>${tnames.length ? esc(tnames.join(' + ')) : '未选工具'}</b>
          ${pnames.length ? ' ＋ ' + esc(pnames.join(' + ')) : ' ＋ 未选套餐'}<br>
          ${checks.map(c => `<span style="color:${c.ok ? 'var(--c1)' : 'var(--c3)'}">${c.ok ? '✓' : '✗'} ${esc(c.txt)}</span>`).join('　')}
        </div>`;
    }
  }

  /* =========================================================
     CHANGELOG / SOURCES
     ========================================================= */
  function renderChangelog() {
    renderChanges();
    const el = $('#logList');
    if (!el) return;
    const KD = { add: '新增', chg: '变更', del: '下线', note: '备注' };
    if (!LOG.length) { el.innerHTML = '<div class="empty">暂无更新记录</div>'; return; }
    el.innerHTML = LOG.map(e => `
      <div class="cl">
        <div class="d">${esc(e.date)}</div>
        <div class="b">
          <div class="t"><span class="kd ${esc(e.kind)}">${esc(KD[e.kind] || e.kind)}</span>${esc(e.title)}</div>
          <div class="x">${esc(e.body)}</div>
          ${e.items ? `<ul class="ul" style="margin-top:6px">${e.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        </div>
      </div>`).join('');
  }

  /* =========================================================
     变化时间线：价格变动 + 本站改动合成一条流
     ---------------------------------------------------------
     更新日志页的承诺是「让你知道哪条信息可能已经过期了」，
     但价格变化以前只散落在每个套餐的 history 里，没人会逐条点开对照。
     这里把它们按日期摊平：哪天、哪一档、从多少到多少、为什么。
     ========================================================= */
  function changeFeed() {
    const out = [];
    PLANS.forEach(p => {
      const h = (p.history || []).filter(x => x && x.date)
        .slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
      for (let i = 1; i < h.length; i++) {
        const cur = h[i], prev = h[i - 1];
        const delta = (cur.price || 0) - (prev.price || 0);
        const why = cur.note || '';
        // 价格没动、也没有说明，就不算「变化」——否则时间线会被「维持」刷满
        if (delta === 0 && (!why || why === '维持')) continue;
        out.push({
          date: cur.date, kind: 'price', planId: p.id,
          title: p.name + ' ' + p.tier,
          from: prev.price, to: cur.price, delta,
          pct: prev.price ? delta / prev.price * 100 : null,
          why
        });
      }
    });
    LOG.forEach(e => out.push({
      date: e.date, kind: 'site', title: e.title, body: e.body, items: e.items
    }));
    out.sort((a, b) => String(b.date).localeCompare(String(a.date))
      || (a.kind === 'price' ? -1 : 1));
    return out;
  }

  const CH_STATE = { filter: 'all', limit: 8 };

  function priceMove(x) {
    const sign = x.delta > 0 ? '+' : '';
    const cls = x.delta > 0 ? 'up' : x.delta < 0 ? 'down' : 'flat';
    const pct = x.pct == null ? '' : `<span class="mvPct ${cls}">${sign}${x.pct.toFixed(1)}%</span>`;
    return `<span class="mvFrom">¥${x.from}</span><span aria-hidden="true">→</span>`
      + `<span class="mvTo">¥${x.to}</span>${pct}`
      + (x.why ? `<span class="mvWhy">${esc(x.why)}</span>` : '');
  }

  function chRow(x) {
    if (x.kind === 'price') {
      const fix = {
        title: '价格不对', entry: x.title,
        current: '¥' + x.to + '（' + x.date + ' 起）'
      };
      return `<div class="cl chRow">
        <div class="d">${esc(x.date)}</div>
        <div class="b">
          <div class="t"><span class="kd chg">价格</span>${esc(x.title)}</div>
          <div class="mv">${priceMove(x)}</div>
        </div>
        <button class="chip fix" type="button" data-fix="${esc(JSON.stringify(fix))}"
          aria-label="报告这一条价格有误">纠错</button>
      </div>`;
    }
    return `<div class="cl chRow">
      <div class="d">${esc(x.date)}</div>
      <div class="b">
        <div class="t"><span class="kd note">本站</span>${esc(x.title)}</div>
        <div class="x">${esc(x.body)}</div>
        ${x.items ? `<ul class="ul" style="margin-top:6px">${x.items.slice(0, 3).map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      </div>
    </div>`;
  }

  function renderChanges() {
    const el = $('#chFeed');
    if (!el) return;
    const all = changeFeed();
    const nPrice = all.filter(x => x.kind === 'price').length;
    const sum = $('#chSum');
    if (sum) {
      sum.innerHTML = all.length
        ? `共 <b>${all.length}</b> 条：价格变动 <b>${nPrice}</b> 条、本站改动 <b>${all.length - nPrice}</b> 条。最近一条在 <b>${esc(all[0].date)}</b>。`
        : '还没有可展示的变化记录。';
    }
    const list = all.filter(x => CH_STATE.filter === 'all' || x.kind === CH_STATE.filter);
    const show = list.slice(0, CH_STATE.limit);
    el.innerHTML = show.length
      ? show.map(chRow).join('')
      : '<div class="empty">这个筛选下没有记录。</div>';
    const more = $('#chMore');
    if (more) {
      const rest = list.length - show.length;
      more.hidden = rest <= 0;
      more.textContent = rest > 0 ? `再展开 ${Math.min(rest, 12)} 条（还有 ${rest} 条）` : '';
    }
    $$('#chChips button').forEach(b => b.classList.toggle('on', b.dataset.ch === CH_STATE.filter));
  }

  /* 首页那条精简版：只给最后三条，作用不是「看全」，是让人知道这站还活着 */
  function renderHomeChanges() {
    const el = $('#homeChg');
    if (!el) return;
    const all = changeFeed();
    if (!all.length) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = `<div class="hcH"><b>最近变化</b><a href="#changelog">全部 ${all.length} 条 →</a></div>`
      + all.slice(0, 3).map(x => `<div class="hcR">
          <span class="hcD">${esc(String(x.date).slice(2))}</span>
          <span>${x.kind === 'price' ? esc(x.title) + ' ' + priceMove(x) : esc(x.title)}</span>
        </div>`).join('');
  }

  /* =========================================================
     纠错入口：把「我觉得这条不对」变成一条能处理的 issue
     ---------------------------------------------------------
     GitHub 的 issue 表单（.yml）只支持预填 title，不支持预填正文。
     所以点「纠错」进的是正确的表单 + 正确的标题，旁边再给一个「复制上下文」，
     让用户不用在页面和表单之间手抄条目名和价格。
     ========================================================= */
  function fixIssueUrl(o) {
    if (!SITE.issue) return '';
    // 标题沿用模板的 [数据] 前缀，标签由模板自己声明，不在 URL 里重复指定
    const t = '[数据] ' + (o.title || '数据纠错') + (o.entry ? '：' + o.entry : '');
    return SITE.issue + '?template=data-correction.yml&title='
      + encodeURIComponent(t.slice(0, 120));
  }

  function fixContext(o) {
    const here = location.hash || '#home';
    return [
      '## 需要核对的数据', '',
      o.entry ? '- 条目：' + o.entry : '',
      o.current ? '- 页面当前显示：' + o.current : '',
      o.expected ? '- 我认为应该是：' + o.expected : '',
      '', '## 依据', '',
      '- 官方页面：', '- 我看到的时间：' + todayStr(),
      '', '## 页面', '',
      (SITE.url ? SITE.url + here : here)
    ].filter(x => x !== '').join('\n');
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-fix]');
    if (!b) return;
    e.preventDefault();
    let o = {};
    try { o = JSON.parse(b.dataset.fix || '{}'); } catch (err) { o = {}; }
    const u = fixIssueUrl(o);
    if (u) {
      window.open(u, '_blank', 'noopener');
      copyText(fixContext(o), '纠错模板已复制，没打开浏览器标签的话直接粘进 issue');
      return;
    }
    copyText(fixContext(o), '已复制纠错模板（本地没有关联公开仓库）');
  });

  // 变化时间线的筛选与「再展开」：只重画这一段，不动整页
  document.addEventListener('click', e => {
    const c = e.target.closest('#chChips button');
    if (c) { CH_STATE.filter = c.dataset.ch; CH_STATE.limit = 8; renderChanges(); return; }
    if (e.target.closest('#chMore')) { CH_STATE.limit += 12; renderChanges(); }
  });

  /* 页脚与健康页的对外出口：纠错、订阅、源码。
     没有公开仓库时（本地双击打开）只留「复制模板」——不给死链。 */
  function renderSiteLinks() {
    const feed = SITE.url && SITE.url.length > 1 ? SITE.url + 'feed.xml' : '';
    const sf = $('#sfLinks');
    if (sf) {
      /* 静态长尾页只在网页版存在（file:// 下没有 t/ 与 p/ 目录）。
         给搜索引擎一条从首页进得去的内部链接，别让 88 个页面只能靠 sitemap 被发现。 */
      const web = /^https?:$/.test(location.protocol);
      sf.innerHTML = [
        `<button type="button" data-fix='{"title":"数据纠错"}'>报告数据错误</button>`,
        feed ? `<a href="${esc(feed)}" target="_blank" rel="noopener">RSS 订阅</a>` : '',
        SITE.repo ? `<a href="${esc(SITE.repo)}" target="_blank" rel="noopener">GitHub 源码</a>` : '',
        web ? `<a href="t/">工具索引</a>` : '',
        web ? `<a href="p/">套餐索引</a>` : ''
      ].filter(Boolean).join('');
    }
    const hf = $('#healthFix');
    if (hf) {
      hf.innerHTML = [
        `<button class="chip" type="button" data-fix='{"title":"数据纠错"}'>报告一条数据错误</button>`,
        SITE.repo ? `<a class="chip" href="${esc(SITE.repo + '/issues')}" target="_blank" rel="noopener">看已有的纠错</a>` : '',
        feed ? `<a class="chip" href="${esc(feed)}" target="_blank" rel="noopener">订阅更新</a>` : ''
      ].filter(Boolean).join('');
    }
  }

  /* =========================================================
     SOURCES
     ========================================================= */
  function renderSources() {
    const g = $('#srcGroups');
    if (g) {
      g.innerHTML = (SRC.groups || []).map(grp => `
        <div class="panel">
          <h3><span class="ic">${esc(grp.icon)}</span>${esc(grp.name)}</h3>
          <div class="srcList">
            ${grp.items.map((x, i) => `
              <div class="sr">
                <div class="n">${String(i + 1).padStart(2, '0')}</div>
                <div style="flex:1">
                  <a href="${esc(x.u)}" target="_blank" rel="noopener" style="font-weight:700">${esc(x.n)} ↗</a>
                  <div class="mini" style="margin-top:2px">${esc(x.d)}</div>
                </div>
                <div style="flex:0 0 130px;text-align:right;font-size:var(--fs-1);color:var(--dim2)">${esc(x.usedFor || '')}</div>
              </div>`).join('')}
          </div>
        </div>`).join('');
    }
    const m = $('#srcMethod');
    if (m) m.innerHTML = (SRC.method || []).map(x => `<li>${esc(x)}</li>`).join('');
    const c = $('#srcCaveats');
    if (c) c.innerHTML = (SRC.caveats || []).map(x => `<li>${esc(x)}</li>`).join('');
    renderRefreshPanel();
  }

  function renderRefreshPanel() {
    const box = $('#srcRefresh');
    if (!box) return;
    if (!RR) {
      box.innerHTML = '<div class="empty">还没有运行过自动更新。在项目目录执行 <code>node scripts/refresh.js</code>，这里会显示每个源的状态与数据新鲜度。</div>';
      return;
    }
    const feeds = RR.feeds || [], pricing = RR.pricing || [], fresh = RR.freshness || [];
    const okF = feeds.filter(f => f.ok).length, okP = pricing.filter(p => p.ok).length;
    box.innerHTML = `
      <div class="refreshTop">
        <div><b>${esc((RR.at || '').replace('T', ' ').slice(0, 16))}</b><span>最近一次运行 · ${RR.offline ? '离线模式' : '联网'} · ${Math.round((RR.durationMs || 0) / 1000)}s</span></div>
        <div><b>${okF}/${feeds.length}</b><span>新闻源成功</span></div>
        <div><b>${okP}/${pricing.length}</b><span>价格页成功</span></div>
        <div><b>${(RR.news && RR.news.fetched) || 0}</b><span>本次新增条目</span></div>
        <div><b>${(RR.priceChanges || []).length}</b><span>价格页有变化</span></div>
      </div>
      <div class="freshGrid">
        ${fresh.map(f => `<div class="freshItem ${f.stale ? 'stale' : ''}">
          <span>${esc(f.name)}</span>
          <b>${f.days == null ? '—' : f.days + ' 天'}</b>
          <em>${esc(f.date || '无日期')}${f.stale ? ' · 超过 30 天' : ''}</em>
        </div>`).join('')}
      </div>
      <div class="feedCols">
        <div class="feedCol"><b>新闻源</b>${feeds.map(f => `<div class="feedRow"><span class="${f.ok ? 'ok' : 'bad'}">${f.ok ? '✓' : '×'}</span>${esc(f.name)}<em>${f.ok ? (f.n || 0) + ' 条' : esc(f.err || '失败')}</em></div>`).join('')}</div>
        <div class="feedCol"><b>价格页</b>${pricing.map(p => `<div class="feedRow"><span class="${p.ok ? (p.changed ? 'warn' : 'ok') : 'bad'}">${p.ok ? (p.changed ? '!' : '✓') : '×'}</span>${esc(p.name)}<em>${p.ok ? (p.changed ? '有变化，去核价' : '无变化') : esc(p.err || '失败')}</em></div>`).join('')}</div>
      </div>
      <div class="note" style="margin-top:14px">价格页只做指纹比对，改价永远需要人工确认——自动解析会把“$20 起”读成“$20”。运行：<code>node scripts/refresh.js</code>；只检查不写盘：<code>--dry</code>；CI 里建议每周一次。</div>`;
  }

  /* =========================================================
     v5 · 新页面：AI 大事 / 冲击 / 角色 / 白嫖
     ========================================================= */
  const pad2 = n => String(n).padStart(2, '0');
  function dateParts(d) {
    const x = String(d || '').split('-');
    return { y: x[0] || '', m: x[1] || '', d: x[2] || '' };
  }
  function money(p) {
    if (!p) return '—';
    if (p.price === 0 && p.form === 'paygo') return '按量计费';
    if (p.price === 0) return '免费';
    if (p.currency === 'USD') {
      return `$${p.priceLocal}<small> ≈ ¥${p.price}</small>`;
    }
    return `¥${p.price}`;
  }
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  /* ---------------- AI 大事 ---------------- */
  function newsPool() {
    const manual = (NEWS.events || []).map(e => Object.assign({}, e, { auto: false }));
    const auto = state.newsAuto ? (NEWS_AUTO.events || []).map(e => Object.assign({}, e, { auto: true })) : [];
    return manual.concat(auto).sort((a, b) => (a.date < b.date ? 1 : -1));
  }
  function renderNews() {
    const intro = NEWS.intro || {};
    const head = $('#newsHead');
    const autoN = (NEWS_AUTO.events || []).length;
    if (head) {
      head.innerHTML = `
        <h2 class="secH">${esc(intro.title || 'AI 大事')}</h2>
        <p class="phLead">${esc(intro.lead || '')}</p>
        <div class="phMeta">
          <span>人工核过 <b>${(NEWS.events || []).length}</b> 条</span>
          <span>自动抓取 <b>${autoN}</b> 条</span>
          <span>更新 <b>${esc(NEWS.updated || '—')}</b></span>
          ${RR ? `<span>管线 <b>${esc((RR.at || '').slice(0, 10))}</b></span>` : ''}
        </div>`;
    }
    const rf = $('#newsRegion');
    if (rf) {
      const opts = [{ id: 'all', n: '全部' }, { id: 'cn', n: '国内' }, { id: 'global', n: '国外' }];
      rf.innerHTML = opts.map(o => `<button class="seg ${state.newsRegion === o.id ? 'on' : ''}" data-r="${o.id}">${o.n}</button>`).join('');
      $$('#newsRegion .seg').forEach(b => b.onclick = () => { state.newsRegion = b.dataset.r; renderNews(); });
    }
    const kf = $('#newsKind');
    if (kf) {
      const kinds = NEWS.kinds || {};
      const opts = [{ id: 'all', name: '全部', icon: '◌' }].concat(Object.entries(kinds).map(([id, k]) => ({ id, name: k.name, icon: k.icon })));
      kf.innerHTML = opts.map(o => `<button class="seg ${state.newsKind === o.id ? 'on' : ''}" data-k="${o.id}"><i>${esc(o.icon)}</i>${esc(o.name)}</button>`).join('');
      $$('#newsKind .seg').forEach(b => b.onclick = () => { state.newsKind = b.dataset.k; renderNews(); });
    }
    const inp = $('#newsSearch');
    if (inp) {
      inp.value = state.newsQ;
      inp.oninput = () => { state.newsQ = inp.value; renderNews(); };
    }
    const ta = $('#newsAutoToggle');
    if (ta) {
      ta.checked = state.newsAuto;
      ta.onchange = () => { state.newsAuto = ta.checked; renderNews(); };
    }

    const q = state.newsQ.trim().toLowerCase();
    const list = newsPool().filter(e => {
      if (state.newsRegion !== 'all' && e.region !== state.newsRegion) return false;
      if (state.newsKind !== 'all' && e.kind !== state.newsKind) return false;
      if (q && (e.title + ' ' + (e.body || '') + ' ' + (e.impact || '')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    const cnt = $('#newsCount');
    if (cnt) cnt.textContent = `${list.length} 条`;
    const box = $('#newsList');
    if (!box) return;
    if (!list.length) { box.innerHTML = '<div class="empty">没有匹配的条目。清掉筛选看看。</div>'; return; }
    const kinds = NEWS.kinds || {};
    box.innerHTML = list.map(e => {
      const k = kinds[e.kind] || { name: e.kind || '动态', icon: '·', color: '#666' };
      const dt = dateParts(e.date);
      return `
      <article class="nitem ${e.auto ? 'is-auto' : ''}">
        <div class="nrail"><b>${esc(dt.m)}.${esc(dt.d)}</b><span>${esc(dt.y)}</span><i aria-hidden="true"></i></div>
        <div class="ncard">
          <div class="ntop">
            <span class="nkind" style="--kc:${esc(k.color || '#666')}">${esc(k.icon || '')} ${esc(k.name)}</span>
            <span class="nreg">${e.region === 'cn' ? '国内' : '国外'}</span>
            <span class="nprov ${e.auto ? 'auto' : ''}">${e.auto ? '自动抓取 · 未复核' : '人工核过'}</span>
            <time>${esc(e.date)}</time>
          </div>
          <h3>${esc(e.title)}</h3>
          ${e.body ? `<p class="nbody">${esc(e.body)}</p>` : ''}
          <div class="nimpact ${e.auto ? 'muted' : ''}">
            <b>对测试</b>
            <p>${e.auto ? '自动抓取条目，未做人工判断。先读原文，再判断它是否影响你的流程。' : esc(e.impact)}</p>
          </div>
          <div class="nfoot">
            <a href="${esc((e.source || {}).url || '#')}" target="_blank" rel="noopener">${esc((e.source || {}).name || '来源')} ↗</a>
            ${(e.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}
          </div>
        </div>
      </article>`;
    }).join('');
  }

  /* ---------------- AI 对测试的冲击 ---------------- */
  function renderImpact() {
    const head = $('#impactHead');
    if (head) {
      head.innerHTML = `
        <h2 class="secH">${esc(IMP.intro.title)}</h2>
        <p class="phLead">${esc(IMP.intro.lead)}</p>
        <div class="phMeta"><span>数据 <b>${(IMP.numbers || []).length}</b> 组</span><span>活动 <b>${(IMP.matrix.rows || []).length}</b> 项</span><span>方案 <b>90</b> 天</span><span>更新 <b>${esc(IMP.updated)}</b></span></div>`;
    }
    const ng = $('#impNums');
    if (ng) {
      ng.innerHTML = (IMP.numbers || []).map(n => `
        <div class="numBlock">
          <div class="nb ${String(n.v).length > 5 ? 'sm' : ''}">${esc(n.v)}</div>
          <div class="nk">${esc(n.k)}</div>
          <p>${esc(n.d)}</p>
          <div class="ns">${esc(n.src)}</div>
        </div>`).join('');
    }
    const sl = $('#impShifts');
    if (sl) {
      sl.innerHTML = (IMP.shifts || []).map(s => `
        <div class="shiftRow">
          <div class="si">${esc(s.n)}</div>
          <div class="sm">
            <h3>${esc(s.title)}</h3>
            <p>${esc(s.body)}</p>
            <div class="sev"><b>证据</b>${esc(s.evidence)}</div>
            <div class="sdo"><b>现在做</b>${esc(s.do)}</div>
          </div>
        </div>`).join('');
    }
    const mt = $('#impMatrix');
    if (mt) {
      const m = IMP.matrix;
      mt.innerHTML = `
        <div class="mtNote">${esc(m.note)}</div>
        <table class="dt">
          <thead><tr>${m.cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
          <tbody>${m.rows.map(r => `
            <tr>
              <td class="mtA">${esc(r.a)}</td>
              <td class="mtV"><div class="mtBar"><i style="width:${r.v}%"></i></div><b>${r.v}</b></td>
              <td>${esc(r.gone)}</td>
              <td>${esc(r.left)}</td>
              <td>${esc(r.move)}</td>
            </tr>`).join('')}</tbody>
        </table>`;
    }
    const pb = $('#impPlaybook');
    if (pb) {
      pb.innerHTML = (IMP.playbook.phases || []).map(p => `
        <div class="phase">
          <div class="phD">${esc(p.d)}</div>
          <h3>${esc(p.name)}</h3>
          <ol>${p.actions.map(a => `<li>${esc(a)}</li>`).join('')}</ol>
          <div class="phOut"><b>交付物</b>${esc(p.out)}</div>
        </div>`).join('');
    }
    const ap = $('#impAnti');
    if (ap) {
      ap.innerHTML = (IMP.antiPatterns || []).map((x, i) => `
        <div class="anti">
          <div class="ai">${pad2(i + 1)}</div>
          <h3>${esc(x.t)}</h3>
          <p>${esc(x.d)}</p>
          <div class="afix"><b>改法</b>${esc(x.fix)}</div>
        </div>`).join('');
    }
    const is = $('#impSources');
    if (is) {
      is.innerHTML = (IMP.sources || []).map(x => `
        <li><a href="${esc(x.u)}" target="_blank" rel="noopener">${esc(x.n)} ↗</a><span>${esc(x.d)}</span></li>`).join('');
    }
    renderImpCheck();
  }

  function renderImpCheck() {
    const box = $('#impCheck');
    if (!box) return;
    const sc = IMP.selfCheck || { qs: [], bands: [] };
    const checked = state.impCheck || [];
    const score = checked.filter(Boolean).length;
    const band = (sc.bands || []).find(b => score >= b.min && score <= b.max) || (sc.bands || [])[0];
    box.innerHTML = `
      <div class="ckList">
        ${(sc.qs || []).map((q, i) => `
          <label class="ck ${checked[i] ? 'on' : ''}">
            <input type="checkbox" data-i="${i}" ${checked[i] ? 'checked' : ''}>
            <span class="ckBox" aria-hidden="true"></span>
            <span>${esc(q)}</span>
          </label>`).join('')}
      </div>
      <div class="ckOut">
        <div class="ckScore"><b>${score}</b><span>/ ${(sc.qs || []).length}</span></div>
        <div class="ckBand">
          <div class="ckName">${esc(band ? band.name : '—')}</div>
          <p>${esc(band ? band.d : '')}</p>
          ${band && band.go ? `<a class="btn sm primary" href="${esc(band.go)}">下一步 →</a>` : ''}
        </div>
      </div>`;
    $$('#impCheck input[data-i]').forEach(inp => {
      inp.onchange = () => {
        state.impCheck[+inp.dataset.i] = inp.checked;
        renderImpCheck();
      };
    });
  }

  /* ---------------- 测试角色阶梯 ---------------- */
  function roleById(id) { return (ROLE.roles || []).find(r => r.id === id); }
  function renderRoles() {
    const head = $('#rolesHead');
    if (head) {
      head.innerHTML = `
        <h2 class="secH">${esc(ROLE.intro.title)}</h2>
        <p class="phLead">${esc(ROLE.intro.lead)}</p>
        <div class="phMeta"><span>角色 <b>${(ROLE.roles || []).length}</b></span><span>级别 <b>3</b></span><span>象限 <b>4</b></span><span>更新 <b>${esc(ROLE.updated)}</b></span></div>`;
    }
    const rq = $('#roleQuad');
    if (rq) {
      rq.innerHTML = (ROLE.relation.quads || []).map(q => `
        <div class="quad">
          <div class="qi">${esc(q.icon)}</div>
          <div class="qh"><h3>${esc(q.name)}</h3><span>${esc(q.en)}</span></div>
          <p class="qw">${esc(q.what)}</p>
          <div class="qrow"><b>例子</b><span>${q.examples.map(esc).join(' · ')}</span></div>
          <div class="qrow"><b>指标</b><span>${q.metrics.map(esc).join(' · ')}</span></div>
          <div class="qfail"><b>常见失败</b>${esc(q.fail)}</div>
        </div>`).join('');
    }

    const tabs = $('#roleStages');
    if (tabs) {
      tabs.innerHTML = (ROLE.stages || []).map(s => `
        <button class="stageTab ${state.roleStage === s.id ? 'on' : ''}" data-s="${s.id}">
          <b>${s.id === 1 ? 'Ⅰ' : s.id === 2 ? 'Ⅱ' : 'Ⅲ'}</b>
          <span>${esc(s.name)}</span>
          <em>${esc(s.desc)}</em>
        </button>`).join('');
      $$('#roleStages .stageTab').forEach(b => b.onclick = () => {
        state.roleStage = +b.dataset.s;
        const first = (ROLE.roles || []).find(r => r.stage === state.roleStage);
        if (first) state.roleId = first.id;
        renderRoles();
      });
    }

    const list = $('#roleList');
    if (list) {
      const rs = (ROLE.roles || []).filter(r => r.stage === state.roleStage);
      list.innerHTML = rs.map(r => `
        <button class="roleCard ${state.roleId === r.id ? 'on' : ''}" data-r="${esc(r.id)}">
          <span class="rcIco">${esc(r.icon)}</span>
          <span class="rcName">${esc(r.name)}</span>
          <span class="rcEn">${esc(r.en)}</span>
          <span class="rcPen"><i style="width:${r.penetration}%"></i><b>${r.penetration}</b></span>
          <span class="rcRisk ${r.risk === '压缩' ? 'down' : r.risk === '稀缺' ? 'hot' : 'up'}">${esc(r.risk)}</span>
        </button>`).join('');
      $$('#roleList .roleCard').forEach(b => b.onclick = () => { state.roleId = b.dataset.r; renderRoles(); });
    }

    const d = roleById(state.roleId) || (ROLE.roles || [])[0];
    const det = $('#roleDetail');
    if (det && d) {
      const next = d.next ? roleById(d.next) : null;
      det.innerHTML = `
        <div class="rdTop">
          <div>
            <div class="rdEn">${esc(d.en)}</div>
            <h2>${esc(d.name)}</h2>
            <p class="rdLine">${esc(d.oneLine)}</p>
          </div>
          <div class="rdScore">
            <div class="rdNum">${d.penetration}<small>%</small></div>
            <div class="rdLbl">AI 渗透度（本站评估）</div>
            <div class="rdRisk ${d.risk === '压缩' ? 'down' : d.risk === '稀缺' ? 'hot' : 'up'}">${esc(d.risk)}</div>
          </div>
        </div>
        <div class="rdGrid">
          <div class="rdCol"><h4>每天在交付什么</h4><ul>${d.work.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
          <div class="rdCol"><h4>AI 接手了什么</h4><ul class="ai">${d.aiUse.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
          <div class="rdCol"><h4>仍然只属于人</h4><ul class="hu">${d.human.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
        </div>
        <div class="rdFoot">
          <div class="rdMetrics"><b>怎么算干得好</b>${d.metrics.map(x => `<span>${esc(x)}</span>`).join('')}</div>
          <div class="rdTools"><b>本站对应工具</b>${d.tools.map(id => {
            const t = TOOLS.find(x => x.id === id);
            return t ? `<button class="toolChip" data-tool="${esc(id)}">${esc(t.name)}</button>` : '';
          }).join('')}</div>
        </div>
        <div class="rdWatch"><b>风险</b>${esc(d.riskNote)}</div>
        ${next ? `<div class="rdNext"><span>下一站</span><button class="linkBtn" data-r="${esc(next.id)}">${esc(next.name)} →</button></div>` : '<div class="rdNext"><span>下一站</span><b>没有更高的一格：往跨团队与架构走</b></div>'}`;
      $$('#roleDetail [data-tool]').forEach(b => b.onclick = () => openTool(b.dataset.tool));
      $$('#roleDetail .linkBtn').forEach(b => b.onclick = () => {
        state.roleId = b.dataset.r;
        const r = roleById(b.dataset.r);
        if (r) state.roleStage = r.stage;
        renderRoles();
      });
    }

    const lv = $('#roleLevels');
    if (lv) {
      lv.innerHTML = (ROLE.levels || []).map((l, i) => `
        <div class="lvCard">
          <div class="lvN">${String(i + 1).padStart(2, '0')}</div>
          <h3>${esc(l.name)}<span>${esc(l.years)}</span></h3>
          <p class="lvDef">${esc(l.def)}</p>
          <div class="lvList"><b>可验证的证据</b>${l.evidence.map(x => `<div>${esc(x)}</div>`).join('')}</div>
          <div class="lvAi"><b>AI 怎么用</b>${esc(l.ai)}</div>
        </div>`).join('');
    }

    const mx = $('#roleMatrix');
    if (mx) {
      mx.innerHTML = `
        <div class="mtNote">${esc(ROLE.matrix.note)}</div>
        <table class="dt roleTable">
          <thead><tr><th>角色</th>${(ROLE.levels || []).map(l => `<th>${esc(l.name)}</th>`).join('')}</tr></thead>
          <tbody>${(ROLE.matrix.rows || []).map(r => {
            const role = roleById(r.role);
            return `<tr><td class="rtRole">${esc(role ? role.name : r.role)}</td>${r.cells.map(c => `
              <td><b>${esc(c.d)}</b><span class="rtAi">${esc(c.ai)}</span></td>`).join('')}</tr>`;
          }).join('')}</tbody>
        </table>`;
    }
    const src = $('#roleSources');
    if (src) {
      src.innerHTML = (ROLE.sources || []).map(s => `
        <li><a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.n)} ↗</a><span>${esc(s.d)}</span></li>`).join('');
    }
  }

  /* ---------------- 白嫖地图 ---------------- */
  function renderFree() {
    const intro = FB.intro || {};
    const head = $('#freeHead');
    if (head) {
      head.innerHTML = `
        <h2 class="secH">${esc(intro.title || '白嫖地图')}</h2>
        <p class="phLead">${esc(intro.lead || '')}</p>
        <div class="phMeta"><span>条目 <b>${(FB.items || []).length}</b></span><span>分类 <b>${(FB.categories || []).length}</b></span><span>更新 <b>${esc(FB.updated)}</b></span></div>`;
    }
    const cf = $('#freeCat');
    if (cf) {
      const opts = [{ id: 'all', name: '全部', icon: '◌' }].concat(FB.categories || []);
      cf.innerHTML = opts.map(c => `<button class="seg ${state.freeCat === c.id ? 'on' : ''}" data-c="${esc(c.id)}"><i>${esc(c.icon || '')}</i>${esc(c.name)}</button>`).join('');
      $$('#freeCat .seg').forEach(b => b.onclick = () => { state.freeCat = b.dataset.c; renderFree(); });
    }
    const rf = $('#freeRegion');
    if (rf) {
      rf.innerHTML = [{ id: 'all', n: '全部' }, { id: 'cn', n: '国内' }, { id: 'global', n: '国外' }]
        .map(o => `<button class="seg ${state.freeRegion === o.id ? 'on' : ''}" data-r="${o.id}">${o.n}</button>`).join('');
      $$('#freeRegion .seg').forEach(b => b.onclick = () => { state.freeRegion = b.dataset.r; renderFree(); });
    }
    const list = (FB.items || []).filter(x =>
      (state.freeCat === 'all' || x.cat === state.freeCat) &&
      (state.freeRegion === 'all' || x.region === state.freeRegion));
    const cnt = $('#freeCount');
    if (cnt) cnt.textContent = `${list.length} 条`;
    const grid = $('#freeGrid');
    if (!grid) return;
    if (!list.length) { grid.innerHTML = '<div class="empty">这个筛选下没有条目。</div>'; return; }
    const vc = { '高': 'hi', '中': 'mid', '低': 'low', '无': 'none' };
    grid.innerHTML = list.map(x => {
      const expired = x.expiry && x.expiry < todayStr();
      return `
      <article class="freeCard ${expired ? 'expired' : ''}">
        <div class="fcTop">
          <span class="fcVal ${vc[x.value] || 'mid'}">${esc(x.value)}</span>
          <span class="fcCat">${esc(x.cat === 'cloud' ? '云额度' : x.cat === 'model' ? '模型免费层' : x.cat === 'agent' ? 'Agent 免费档' : '学生/创业')}</span>
          <span class="fcReg">${x.region === 'cn' ? '国内' : '国外'}</span>
          ${expired ? '<span class="fcExp">已过期</span>' : (x.expiry ? `<span class="fcExp soon">至 ${esc(x.expiry)}</span>` : '')}
        </div>
        <h3>${esc(x.name)}</h3>
        <div class="fcVendor">${esc(x.vendor)}</div>
        <div class="fcAmount">${esc(x.amount)}</div>
        <div class="fcRow"><b>怎么领</b><p>${esc(x.how)}</p></div>
        <div class="fcRow"><b>上限</b><p>${esc(x.cap)}</p></div>
        <div class="fcTrap"><b>坑</b><p>${esc(x.trap)}</p></div>
        <div class="fcFoot">
          <a href="${esc(x.url)}" target="_blank" rel="noopener">官方页 ↗</a>
          <span>核对 ${esc(x.verified)}</span>
          ${(x.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}
        </div>
      </article>`;
    }).join('');
    const rules = $('#freeRules');
    if (rules) rules.innerHTML = (intro.rules || []).map(r => `<li>${esc(r)}</li>`).join('');
  }

  /* =========================================================
     COMMUNITY · 社区资源库
     ---------------------------------------------------------
     nav.json 里原本留了一个「测试社区」的坑。真正做的时候没有做社区本体：
     注册、发帖、审核需要一个后端，而「零后端、可离线、不收集任何信息」
     是这个站最硬的三条卖点，做社区就得先推翻它们；单人维护的社区
     三个月后也一定是广告和死链。

     所以这里做的是「精选索引」——不让人发帖，只把散在 GitHub 上、
     测试工程师真的会装的东西筛一遍，写清「干什么用、测试怎么用、坑在哪」。
     这部分是静态站能诚实做的全部。
     ========================================================= */
  const CM_SORTS = [
    { id: 'pick', n: '编辑推荐' },
    { id: 'stars', n: '星数' },
    { id: 'pushed', n: '最近提交' }
  ];
  const cmStats = it => CMS[it.repo] || {};
  const cmStars = it => {
    const s = cmStats(it).stars;
    return typeof s === 'number' ? s : null;
  };
  const cmPushed = it => cmStats(it).pushedAt || '';
  const fmtStars = n => n == null ? '—'
    : n >= 10000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n);

  function cmCard(it) {
    const cat = CM_CAT[it.cat] || { name: it.cat, icon: '·' };
    const st = cmStats(it);
    const stars = cmStars(it);
    const pushed = cmPushed(it);
    const days = pushed ? daysAgo(pushed) : null;
    const when = days == null ? '' : days <= 0 ? '今天有提交'
      : days <= 60 ? `最近提交 ${days} 天前` : `最近提交 ${days} 天前（可能已放缓）`;
    const fits = (it.fits || []).map(id => (TOOLS.find(t => t.id === id) || {}).name).filter(Boolean);
    return `<article class="cmCard${it.pick ? ' pick' : ''}">
      <div class="cmTop">
        <span class="cmCat">${esc(cat.icon || '·')} ${esc(cat.name)}</span>
        ${it.pick ? '<span class="cmPick">编辑推荐</span>' : ''}
        <span class="cmStars" title="GitHub star 数，每周自动刷新">★ ${esc(fmtStars(stars))}</span>
      </div>
      <h3><a href="https://github.com/${esc(it.repo)}" target="_blank" rel="noopener">${esc(it.name)}<span class="cmOut" aria-hidden="true">↗</span></a></h3>
      <div class="cmRepo">${esc(it.repo)} · ${st.license ? esc(st.license) : '许可证未标注'}${st.archived ? ' · <b class="cmArch">已归档</b>' : ''}</div>
      <p class="cmWhat">${esc(it.what)}</p>
      <div class="cmUse"><b>测试怎么用</b><p>${esc(it.use)}</p></div>
      ${it.caveat ? `<div class="cmCaveat"><b>注意</b><p>${esc(it.caveat)}</p></div>` : ''}
      <div class="cmFoot">
        ${pushed ? `<span class="cmMeta" title="最近一次提交：${esc(pushed)}">${esc(when)}</span>` : ''}
        ${fits.length ? `<span class="cmMeta">配 ${esc(fits.slice(0, 3).join(' / '))}</span>` : ''}
        ${favBtn('community', it.id, it.name)}
      </div>
    </article>`;
  }

  function renderCommunity() {
    const intro = CM.intro || {};
    const head = $('#cmHead');
    if (head) {
      head.innerHTML = `
        <h2 class="secH">${esc(intro.title || '社区资源库')}</h2>
        <p class="phLead">${esc(intro.lede || '')}</p>
        <div class="phMeta">
          <span>收录 <b>${(CM.items || []).length}</b></span>
          <span>分类 <b>${(CM.categories || []).length}</b></span>
          <span>星数抓取 <b>${esc((D.communityStats || {}).updated || '—')}</b></span>
        </div>`;
    }

    const cf = $('#cmCats');
    if (cf) {
      const opts = [{ id: 'all', name: '全部', icon: '◌' }].concat(CM.categories || []);
      cf.innerHTML = opts.map(c => {
        const n = c.id === 'all' ? (CM.items || []).length : (CM.items || []).filter(x => x.cat === c.id).length;
        return `<button class="seg ${state.cmCat === c.id ? 'on' : ''}" type="button" data-cat="${esc(c.id)}" aria-pressed="${state.cmCat === c.id}"><i>${esc(c.icon || '')}</i>${esc(c.name)}<span>${n}</span></button>`;
      }).join('');
      $$('#cmCats .seg').forEach(b => b.onclick = () => {
        state.cmCat = b.dataset.cat;
        renderCommunity(); syncHash();
      });
    }

    const sf = $('#cmSort');
    if (sf) {
      sf.innerHTML = CM_SORTS.map(s =>
        `<button class="seg ${state.cmSort === s.id ? 'on' : ''}" type="button" data-sort="${s.id}" aria-pressed="${state.cmSort === s.id}">${s.n}</button>`
      ).join('');
      $$('#cmSort .seg').forEach(b => b.onclick = () => {
        state.cmSort = b.dataset.sort;
        renderCommunity(); syncHash();
      });
    }

    const cur = CM_CAT[state.cmCat];
    const note = $('#cmNote');
    if (note) note.textContent = cur ? cur.desc : (intro.note || '');

    let list = (CM.items || []).filter(x => state.cmCat === 'all' || x.cat === state.cmCat);
    const byStars = (a, b) => (cmStars(b) || 0) - (cmStars(a) || 0);
    if (state.cmSort === 'stars') list = list.slice().sort(byStars);
    else if (state.cmSort === 'pushed') list = list.slice().sort((a, b) => String(cmPushed(b)).localeCompare(String(cmPushed(a))));
    else list = list.slice().sort((a, b) => ((b.pick ? 1 : 0) - (a.pick ? 1 : 0)) || byStars(a, b));

    const cnt = $('#cmCount');
    if (cnt) cnt.textContent = `${list.length} 个`;

    const grid = $('#cmGrid');
    if (grid) {
      grid.innerHTML = list.length
        ? list.map(cmCard).join('')
        : '<div class="empty">这个分类下还没有条目。</div>';
    }

    const rules = $('#cmRules');
    if (rules) {
      rules.innerHTML = [
        '先看「测试怎么用」，再看星数。星数说明有多少人在用，不说明它适合你。',
        '装之前读一眼「注意」。多数 MCP 出事不是因为不能用，是权限给大了。',
        '星数与最近提交由 CI 每周从 GitHub 抓；抓不到就保留上一次的值，不会变成 0。',
        '想加一个：走下面的「提交资源」，写清它解决什么问题。不满足收录标准的会被拒，拒了会说为什么。'
      ].map(x => `<li>${esc(x)}</li>`).join('');
    }

    const sub = $('#cmSubmit');
    if (sub) {
      sub.innerHTML = SITE.issue
        ? `<a class="btn primary" href="${esc(SITE.issue)}?template=resource-submit.yml&title=${encodeURIComponent('[资源] ')}" target="_blank" rel="noopener">＋ 提交一个资源</a>
           <span class="mini">走 GitHub issue。收录标准：与 AI 辅助测试直接相关、近一年有提交、许可证明确。</span>`
        : '<span class="mini">本站未配置仓库地址，暂时不能提交。</span>';
    }
  }

  /* =========================================================
     v6 · 数据健康 / AI 评测集 / 决策报告
     ========================================================= */
  function daysBetween(a, b) {
    const da = new Date(a + 'T00:00:00');
    const db = new Date(b + 'T00:00:00');
    if (isNaN(da) || isNaN(db)) return null;
    return Math.round((db - da) / 86400000);
  }
  function daysAgo(dateStr) {
    const n = daysBetween(dateStr, todayStr());
    return n == null ? null : Math.max(0, n);
  }
  function fmtWhen(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return String(iso);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  /* ---------------- 数据健康 ---------------- */
  function renderHealth() {
    const stale = META.staleAfterDays || 30;
    const age = daysAgo(META.lastVerified);
    const verifiedPlans = PLANS.filter(p => p.verified).length;
    const missingPlans = PLANS.filter(p => !p.verified);
    const stalePlans = PLANS.filter(p => p.verified && (daysAgo(p.verified) || 0) > stale);
    const freeExpired = (FB.items || []).filter(x => x.expiry && x.expiry < todayStr());
    const freeSoon = (FB.items || []).filter(x => {
      if (!x.expiry) return false;
      const n = daysBetween(todayStr(), x.expiry);
      return n != null && n >= 0 && n <= 30;
    });
    const feeds = (RR && RR.feeds) || [];
    const pricing = (RR && RR.pricing) || [];
    const feedsOk = feeds.filter(x => x.ok).length;
    const pricingOk = pricing.filter(x => x.ok).length;
    const srcAll = feeds.length + pricing.length;
    const srcOk = feedsOk + pricingOk;
    const health = age == null ? '未知' : age <= stale ? '健康' : age <= stale * 2 ? '需复核' : '已过期';

    const meta = $('#healthMeta');
    if (meta) meta.innerHTML = `<span>上次核验 <b>${esc(META.lastVerified || '—')}</b></span><span>距今天数 <b>${age == null ? '—' : age}</b></span><span>阈值 <b>${stale} 天</b></span><span>状态 <b>${esc(health)}</b></span>`;

    const queue = [];
    pricing.filter(x => !x.ok).forEach(x => queue.push({ name: `${x.name} · ${x.err || '抓取失败'}`, date: (RR.at || '').slice(0, 10), status: '失败', cls: 'bad', pri: 0 }));
    feeds.filter(x => !x.ok).forEach(x => queue.push({ name: `${x.name} · ${x.err || '抓取失败'}`, date: (RR.at || '').slice(0, 10), status: '失败', cls: 'bad', pri: 0 }));
    missingPlans.forEach(p => queue.push({ name: `${p.name} ${p.tier} · 缺少核验日`, date: '—', status: '待核', cls: 'warn', pri: 1 }));
    stalePlans.forEach(p => queue.push({ name: `${p.name} ${p.tier} · 核验超期`, date: p.verified, status: '待核', cls: 'warn', pri: 1 }));
    freeSoon.forEach(x => queue.push({ name: `${x.name} · 额度将过期`, date: x.expiry, status: '将过期', cls: 'warn', pri: 1 }));
    freeExpired.forEach(x => queue.push({ name: `${x.name} · 已过期`, date: x.expiry, status: '已过期', cls: 'bad', pri: 0 }));
    queue.sort((a, b) => a.pri - b.pri || String(b.date).localeCompare(String(a.date)));

    const grid = $('#healthGrid');
    if (grid) {
      const freshPct = age == null ? 0 : Math.max(0, Math.min(100, 100 - age / stale * 100));
      const covPct = PLANS.length ? verifiedPlans / PLANS.length * 100 : 0;
      const srcPct = srcAll ? srcOk / srcAll * 100 : 0;
      const queuePct = Math.min(100, queue.length * 8);
      grid.innerHTML = `
        <div class="hcard">
          <div class="hl">数据新鲜度</div>
          <div class="hn">${age == null ? '—' : age}<small>天前</small></div>
          <div class="hd">上次人工核验 ${esc(META.lastVerified || '—')}，${health === '健康' ? '未超过' : '已超过'} ${stale} 天阈值。</div>
          <div class="hbar"><i class="${freshPct < 34 ? 'bad' : freshPct < 67 ? 'warn' : ''}" style="width:${Math.round(freshPct)}%"></i></div>
        </div>
        <div class="hcard">
          <div class="hl">套餐核验覆盖</div>
          <div class="hn">${verifiedPlans}<small>/ ${PLANS.length}</small></div>
          <div class="hd">${stalePlans.length} 条超过 ${stale} 天，${missingPlans.length} 条缺失核验日。</div>
          <div class="hbar"><i class="${covPct < 60 ? 'bad' : covPct < 90 ? 'warn' : ''}" style="width:${Math.round(covPct)}%"></i></div>
        </div>
        <div class="hcard">
          <div class="hl">自动更新源</div>
          <div class="hn">${srcAll ? srcOk : '—'}<small>/ ${srcAll || '—'}</small></div>
          <div class="hd">${srcAll ? `RSS ${feedsOk}/${feeds.length}，定价页 ${pricingOk}/${pricing.length}；${srcAll - srcOk} 个源失败。` : '自动更新尚未运行，成功率未知。'}</div>
          <div class="hbar"><i class="${srcPct < 50 ? 'bad' : srcPct < 80 ? 'warn' : ''}" style="width:${Math.round(srcPct)}%"></i></div>
        </div>
        <div class="hcard">
          <div class="hl">待办 / 将过期</div>
          <div class="hn">${queue.length}<small>项</small></div>
          <div class="hd">${stalePlans.length + missingPlans.length} 条套餐待核；${freeSoon.length} 条额度 30 天内到期，${freeExpired.length} 条已过期；${srcAll - srcOk} 个抓取源失败。</div>
          <div class="hbar"><i class="${queue.length > 12 ? 'bad' : queue.length ? 'warn' : ''}" style="width:${Math.round(queuePct)}%"></i></div>
        </div>`;
    }

    const qBox = $('#healthQueue');
    if (qBox) {
      qBox.innerHTML = queue.length
        ? queue.slice(0, 8).map(q => `<div class="hrow"><span class="hnm">${esc(q.name)}</span><span class="hdt">${esc(q.date || '—')}</span><span class="hst ${q.cls}">${esc(q.status)}</span></div>`).join('')
          + (queue.length > 8 ? `<div class="hnote">另有 ${queue.length - 8} 项，复制待办可拿到完整清单。</div>` : '')
        : '<div class="note good"><b>当前没有待核项。</b>所有套餐都有核验日，免费额度也没有 30 天内到期。</div>';
    }
    const qa = $('#healthQueueActions');
    if (qa) {
      qa.innerHTML = `<button class="exportBtn" type="button" id="healthCopyTodo"><span>复制核价待办（Markdown）</span><em>COPY</em></button>
        <a class="exportBtn" href="exports/plans.csv" download><span>导出全部套餐 CSV</span><em>CSV</em></a>`;
      const btn = $('#healthCopyTodo');
      if (btn) btn.onclick = () => {
        const lines = ['# 核价待办 · ' + todayStr(), '', ...queue.map(q => `- [ ] ${q.name} · ${q.date || '—'} · ${q.status}`)];
        copyText(lines.join('\n'), '核价待办已复制');
      };
    }

    const groups = {};
    pricing.filter(x => !x.ok).forEach(x => { const k = x.err || '未知错误'; (groups[k] = groups[k] || []).push(x.name); });
    feeds.filter(x => !x.ok).forEach(x => { const k = x.err || '未知错误'; (groups[k] = groups[k] || []).push(x.name); });
    const srcBox = $('#healthSources');
    if (srcBox) {
      const keys = Object.keys(groups);
      srcBox.innerHTML = keys.length
        ? keys.map(k => `<div class="hfail"><b>${esc(groups[k].join(' / '))}</b><code>${esc(k)}</code></div>`).join('')
        : (srcAll ? `<div class="note good"><b>最近一次运行没有失败源。</b>RSS ${feeds.length} 个、定价页 ${pricing.length} 个全部成功。</div>` : '<div class="empty">还没有自动更新运行记录。</div>');
    }
    const note = $('#healthNote');
    if (note) {
      note.innerHTML = RR
        ? `RSS ${feedsOk}/${feeds.length} · 定价页 ${pricingOk}/${pricing.length} · 新闻新增 ${(RR.news && RR.news.fetched) || 0} 条 · 价格指纹变化 ${(RR.priceChanges || []).length} 条<br>最近运行：${esc(fmtWhen(RR.at))}`
        : '自动更新尚未运行：没有 <code>_refresh-report.json</code>，失败源与成功率未知。';
    }
    const hx = $('#healthExports');
    if (hx) {
      const files = [
        ['tools.json', '工具数据', 'JSON'], ['plans.json', '套餐数据', 'JSON'],
        ['plans.csv', '套餐表格', 'CSV'], ['plans.md', '套餐文档', 'MD'],
        ['evalset.json', '评测集', 'JSON'], ['manifest.json', '数据清单', 'JSON']
      ];
      hx.innerHTML = files.map(([f, l, t]) => `<a class="exportBtn" href="exports/${f}" download><span>${l} · ${f}</span><em>${t}</em></a>`).join('');
    }
  }

  /* ---------------- AI 评测集 ---------------- */
  function evalFiltered() {
    const q = (state.evalQ || '').trim().toLowerCase();
    return (EVS.cases || []).filter(c => {
      if (state.evalCat !== 'all' && c.cat !== state.evalCat) return false;
      if (!q) return true;
      const hay = [c.id, c.name, c.target, c.input, c.expected, c.oracle, c.severity, (c.tags || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  function renderEvalList() {
    const list = evalFiltered();
    const grid = $('#evalGrid');
    if (grid) {
      grid.innerHTML = list.length ? list.map(c => {
        const cat = (EVS.categories || []).find(x => x.id === c.cat);
        const sev = String(c.severity || '').toLowerCase();
        return `<article class="evalCard">
          <div class="ecTop">
            <span class="ecId">${esc(c.id)}</span>
            <span class="ecSev ${sev}">${esc(c.severity)}</span>
            <span class="ecCat">${esc(cat ? cat.name : c.cat)}</span>
            <button class="ecCopy" type="button" data-ecopy="${esc(c.id)}">复制</button>
          </div>
          <h3>${esc(c.name)}</h3>
          <div class="ecTarget">TARGET · ${esc(c.target)}</div>
          <div class="ecRow"><b>输入</b><span>${esc(c.input)}</span></div>
          <div class="ecRow"><b>预期</b><span>${esc(c.expected)}</span></div>
          <div class="ecOracle"><b>判定器</b>${esc(c.oracle)}</div>
          <div class="ecTags">${(c.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
        </article>`;
      }).join('') : '<div class="empty">这个筛选下没有用例。换个关键词，或点「全部」。</div>';
      $$('#evalGrid [data-ecopy]').forEach(b => b.onclick = () => {
        const c = (EVS.cases || []).find(x => x.id === b.dataset.ecopy);
        if (c) copyText(JSON.stringify(c, null, 2), `已复制 ${c.id}`);
      });
    }
    const pre = $('#evalJSON');
    if (pre) pre.textContent = JSON.stringify(list, null, 2);
  }

  function renderEvalset() {
    const cats = EVS.categories || [];
    const cases = EVS.cases || [];
    const p0 = cases.filter(c => c.severity === 'P0').length;
    const meta = $('#evalMeta');
    if (meta) meta.innerHTML = `<span>用例 <b>${cases.length}</b></span><span>类别 <b>${cats.length}</b></span><span>P0 <b>${p0}</b></span><span>更新 <b>${esc(EVS.updated || '—')}</b></span>`;

    const stats = $('#evalStats');
    if (stats) stats.innerHTML = `
      <div class="es"><b>${cases.length}</b><span>用例总数</span></div>
      <div class="es"><b>${p0}</b><span>P0 高危</span></div>
      <div class="es"><b>${cats.length}</b><span>失败类别</span></div>
      <div class="es"><b>${(EVS.howto || []).length}</b><span>落地步骤</span></div>`;

    const catBox = $('#evalCats');
    if (catBox) {
      const opts = [{ id: 'all', name: '全部', icon: '◌' }].concat(cats);
      catBox.innerHTML = opts.map(c => {
        const n = c.id === 'all' ? cases.length : cases.filter(x => x.cat === c.id).length;
        return `<button class="seg ${state.evalCat === c.id ? 'on' : ''}" data-ecat="${esc(c.id)}"><i>${esc(c.icon || '')}</i>${esc(c.name)} <b>${n}</b></button>`;
      }).join('');
      $$('#evalCats .seg').forEach(b => b.onclick = () => {
        state.evalCat = b.dataset.ecat;
        $$('#evalCats .seg').forEach(x => x.classList.toggle('on', x.dataset.ecat === state.evalCat));
        renderEvalList();
      });
    }

    const inp = $('#evalSearch');
    if (inp) {
      inp.value = state.evalQ;
      inp.oninput = () => { state.evalQ = inp.value; renderEvalList(); };
    }
    const copyAll = $('#evalCopyAll');
    if (copyAll) copyAll.onclick = () => copyText(JSON.stringify(evalFiltered(), null, 2), '已复制当前筛选的 JSON');

    const how = $('#evalHow');
    if (how) how.innerHTML = (EVS.howto || []).map(x => `<li>${esc(x)}</li>`).join('');
    const metrics = $('#evalMetrics');
    if (metrics) metrics.innerHTML = (EVS.metrics || []).map(m => `<div class="metricRow"><b>${esc(m.k)}</b><span>${esc(m.d)}</span></div>`).join('');
    const bands = $('#evalBands');
    if (bands) bands.innerHTML = ((EVS.scoring && EVS.scoring.bands) || []).map(b => `<b>${b.min}–${b.max} ${esc(b.name)}</b>：${esc(b.d)}`).join('；');
    renderEvalList();
  }

  /* ---------------- 决策报告 ---------------- */
  function reportData() {
    const hasPersona = state.peDone && state.peAnswers.length === (PE.questions || []).length;
    const P = hasPersona ? PE.personas[personaWinner(personaScores(state.peAnswers))] : null;
    let b = planTarget();
    if (!b && P && P.bundle) b = BUNDLES.find(x => x.id === P.bundle) || null;
    let toolIds = state.pickedTools.slice();
    let planIds = state.pickedPlans.slice();
    if (!toolIds.length && b) toolIds = [b.tool];
    if (!planIds.length && b && b.plan) planIds = [b.plan];
    const tools = toolIds.map(id => TOOLS.find(t => t.id === id)).filter(Boolean);
    const plans = planIds.map(id => PLANS.find(p => p.id === id)).filter(Boolean);
    const total = tools.reduce((a, t) => a + shellCost(t), 0) + plans.reduce((a, p) => a + p.price, 0);
    const hasCli = tools.some(t => t.scriptable);
    const hasCn = tools.some(t => t.cnDirect);
    const checks = [
      { ok: tools.length > 0, txt: '至少选一个工具壳' },
      { ok: plans.length > 0, txt: '至少选一个模型供给（套餐 / API）' },
      { ok: hasCli, txt: '有一个可脚本化的壳（否则进不了 CI）' },
      { ok: hasCn, txt: '有一个国内直连（否则要解决网络）' }
    ];
    const budget = diag.ans.budget && diag.ans.budget !== 'any' ? +diag.ans.budget : null;
    const comboName = b ? b.name : ([tools.map(t => t.name).join(' + '), plans.map(p => p.name + ' ' + p.tier).join(' + ')].filter(Boolean).join(' ＋ ') || '未选组合');
    return { P, b, tools, plans, total, checks, budget, hasPersona, comboName };
  }

  function reportMarkdown(rd) {
    const { P, b, tools, plans, total, checks, budget, comboName } = rd;
    const L = [];
    L.push('# 测试团队 AI 工具选型建议');
    L.push('');
    L.push(`- 报告编号：ATS-${todayStr().replace(/-/g, '')}-${pad2(tools.length + plans.length)}`);
    L.push(`- 生成日期：${todayStr()}`);
    L.push(`- 数据核验：${META.lastVerified || '—'}`);
    L.push('');
    L.push('## 结论');
    L.push('');
    L.push(`- 诊断类型：${P ? P.name : '未完成诊断'}`);
    L.push(`- 推荐组合：${comboName}`);
    L.push(`- 月成本：¥${total}`);
    L.push(`- 预算余量：${budget ? '¥' + Math.max(0, budget - total) + ' / 月（按 ¥' + budget + ' 上限）' : '未设置预算上限'}`);
    L.push('');
    L.push('## 为什么是这套');
    L.push('');
    tools.forEach(t => L.push(`- 壳：${t.name}（${t.tagline}）`));
    plans.forEach(p => L.push(`- 电：${p.name} ${p.tier}，¥${p.price}/月；${p.priceNote || p.quota || ''}`));
    if (b && b.why) b.why.forEach(x => L.push(`- ${x}`));
    L.push('');
    L.push('## 四项自检');
    L.push('');
    checks.forEach(c => L.push(`- [${c.ok ? 'x' : ' '}] ${c.txt}`));
    L.push('');
    L.push('## 30 天动作');
    L.push('');
    (PP.tasks || []).slice(0, 6).forEach(t => L.push(`- W${t.w} · ${t.t}（验收：${t.acc}）`));
    L.push('');
    L.push('## 风险与边界');
    L.push('');
    if (b && b.watch) L.push(`- 组合风险：${b.watch}`);
    const restr = plans.flatMap(p => p.restrictions || []);
    if (restr.length) L.push(`- 套餐限制：${Array.from(new Set(restr)).join('；')}`);
    L.push('- 数据风险：代码与测试数据能否出境、是否用于训练，采购前必须逐条核对。');
    L.push('- 技术风险：Agent 归因不能替代人工定责；写操作必须二次确认，先只读运行两周。');
    L.push('');
    L.push('---');
    L.push(`数据来源：AI Test Stack · 数据核验日 ${META.lastVerified || '—'} · 生成于 ${todayStr()}`);
    L.push('本报告由本地数据生成，不构成采购承诺；下单前以官网现价与合同条款为准。');
    return L.join('\n');
  }

  function renderReport() {
    const body = $('#reportBody');
    if (!body) return;
    const rd = reportData();
    const { P, b, tools, plans, total, checks, budget, comboName } = rd;
    const meta = $('#reportMeta');

    if (!tools.length && !plans.length && !P) {
      if (meta) meta.innerHTML = '<span>状态 <b>尚未生成</b></span><span>数据核验 <b>' + esc(META.lastVerified || '—') + '</b></span>';
      body.innerHTML = `
        <div class="reportEmpty">
          <div class="reK">NO REPORT YET</div>
          <h2>还没有可报告的方案</h2>
          <p>报告是从「你的诊断 + 你选的组合」长出来的。先花 2 分钟做三问诊断，或者直接去组合页勾一套；回来这里就会自动生成一份可打印的 A4 报告（约 2 页）。</p>
          <div class="gchips" style="justify-content:center">
            <a class="btn primary" href="#home">去首页做三问诊断 →</a>
            <a class="btn" href="#stack">去我的组合挑一套</a>
            <a class="btn" href="#bundles">看 32 套现成组合</a>
          </div>
          <div class="rpExample">报告会包含：结论 / 为什么是这套 / 四项自检 / 30 天动作 / 风险与边界</div>
        </div>`;
      return;
    }

    const rid = `ATS-${todayStr().replace(/-/g, '')}-${pad2(tools.length + plans.length)}`;
    const plan0 = plans[0] || null;
    const alt = PLANS.filter(p => !plans.some(x => x.id === p.id) && (!plan0 || p.region === plan0.region)).sort((a, b) => a.price - b.price)[0];
    const left = budget != null ? Math.max(0, budget - total) : null;
    const goal = P ? P.firstStep : (b ? b.fit : '先定一套能进 CI、预算可控的组合');
    const mode = (PP.meta && PP.meta.weeks && PP.meta.weeks[1]) ? PP.meta.weeks[1].goal : '先只读运行，再进 CI';
    const tasks = (PP.tasks || []).slice(0, 6);
    const risks = [];
    if (b && b.watch) risks.push(['组合风险', b.watch]);
    const restr = Array.from(new Set(plans.flatMap(p => p.restrictions || [])));
    if (restr.length) risks.push(['套餐限制', restr.join('；')]);
    if (plan0 && plan0.priceNote) risks.push(['价格口径', `${plan0.priceNote}；预算按标准价，不按首购价。`]);
    risks.push(['数据风险', '代码与测试数据能否出境、是否用于训练，采购前必须逐条核对；不要只看价格。']);
    risks.push(['技术风险', 'Agent 归因不能替代人工定责；写操作必须二次确认，先只读运行两周。']);

    if (meta) meta.innerHTML = `<span>报告编号 <b>${esc(rid)}</b></span><span>数据核验 <b>${esc(META.lastVerified || '—')}</b></span><span>生成日期 <b>${todayStr()}</b></span><span>状态 <b>${P ? '已含诊断' : '待补诊断'}</b></span>`;

    body.innerHTML = `
      <div class="reportWrap">
        <div class="reportActions">
          <button class="btn sm" type="button" id="rpCopy">复制 Markdown</button>
          <button class="btn sm primary" type="button" id="rpPrint">打印 / 保存 PDF</button>
        </div>
        <div class="reportSheet">
          <div class="rpKicker">AI TEST STACK · DECISION REPORT</div>
          <h1 class="rpH1">测试团队 AI 工具选型建议</h1>
          <p class="rpSub">基于${P ? ' 3 问诊断、' : ''}当前已选组合与 4 周执行包生成。所有价格来自本站核验数据，数据日期与出处见页脚。</p>
          <div class="rpMeta">
            <span>报告编号 <b>${esc(rid)}</b></span>
            <span>生成日期 <b>${todayStr()}</b></span>
            <span>数据核验 <b>${esc(META.lastVerified || '—')}</b></span>
            <span>适用 <b>个人 / 小团队</b></span>
          </div>

          <div class="rpSec">
            <div class="rpSecH"><i>01</i><h2>结论</h2><span>VERDICT</span></div>
            <div class="rpGrid2">
              <div>
                <div class="rpKV"><b>诊断类型</b><span>${esc(P ? P.name : '未完成诊断（建议先做三问）')}</span></div>
                <div class="rpKV"><b>推荐组合</b><span>${esc(comboName)}</span></div>
                <div class="rpKV"><b>月成本</b><span class="rpBig">¥${total}<small>/月</small></span></div>
              </div>
              <div>
                <div class="rpKV"><b>首要目标</b><span>${esc(goal)}</span></div>
                <div class="rpKV"><b>预算余量</b><span>${left != null ? '¥' + left + ' / 月（按 ¥' + budget + ' 上限）' : '未设置预算上限'}</span></div>
                <div class="rpKV"><b>上线方式</b><span>${esc(mode)}</span></div>
              </div>
            </div>
          </div>

          <div class="rpSec">
            <div class="rpSecH"><i>02</i><h2>为什么是这套</h2><span>RATIONALE</span></div>
            <div class="rpGrid2">
              <div>
                <div class="rpKV"><b>壳</b><span>${esc(tools.length ? tools.map(t => `${t.name}：${t.tagline}`).join('；') : '未选工具壳')}</span></div>
                <div class="rpKV"><b>电</b><span>${esc(plans.length ? plans.map(p => `${p.name} ${p.tier} · ¥${p.price}/月 · ${p.priceNote || p.quota || ''}`).join('；') : '未选套餐')}</span></div>
                <div class="rpKV"><b>额度</b><span>${esc(plan0 ? (plan0.quota || '—') : '—')}</span></div>
              </div>
              <div>
                <div class="rpKV"><b>备选</b><span>${esc(alt ? `${alt.name} ${alt.tier} · ¥${alt.price}/月` : '—')}</span></div>
                <div class="rpKV"><b>边界</b><span>${esc(b ? b.watch : (plan0 && plan0.risk) || '按实际用量复核额度与限流。')}</span></div>
                <div class="rpKV"><b>成本口径</b><span>${esc(b ? b.costBasis : comboName)}</span></div>
              </div>
            </div>
          </div>

          <div class="rpSec">
            <div class="rpSecH"><i>03</i><h2>四项自检</h2><span>CHECKS</span></div>
            <ul class="rpCheck">
              ${checks.map(c => `<li class="${c.ok ? '' : 'bad'}"><b>${c.ok ? '✓' : '✗'}</b>${esc(c.txt)}</li>`).join('')}
            </ul>
          </div>

          <div class="rpSec">
            <div class="rpSecH"><i>04</i><h2>30 天动作</h2><span>NEXT 30 DAYS</span></div>
            <ol class="rpTasks">
              ${tasks.map(t => `<li>W${t.w} · ${esc(t.t)}<small>验收：${esc(t.acc)}</small></li>`).join('')}
            </ol>
            <div class="hnote">其余 ${Math.max(0, (PP.tasks || []).length - tasks.length)} 个动作见「落地执行包」；每一步都可勾选留痕。</div>
          </div>

          <div class="rpSec">
            <div class="rpSecH"><i>05</i><h2>风险与边界</h2><span>RISKS</span></div>
            ${risks.map(([k, v]) => `<div class="rpRisk"><b>${esc(k)}：</b>${esc(v)}</div>`).join('')}
          </div>

          <div class="rpFoot">
            <div>
              数据来源：AI Test Stack · data/tools.json、plans.json、planpack.json<br>
              价格核验日 ${esc(META.lastVerified || '—')} · 生成时间 ${todayStr()} · 本报告不构成采购承诺
            </div>
            <div class="rpStamp">LOCAL<br>DATA<br>VERIFIED</div>
          </div>
        </div>
      </div>`;

    const rp = $('#rpPrint');
    if (rp) rp.onclick = () => window.print();
    const rc = $('#rpCopy');
    if (rc) rc.onclick = () => copyText(reportMarkdown(rd), '报告已复制为 Markdown');
  }

  /* ---------------- 套餐阶梯（按工具分组） ---------------- */
  function renderPlanLadder() {
    const box = $('#pLadder');
    if (!box) return;
    const pool = PLANS.filter(p => state.planRegion === 'all' || p.region === state.planRegion);
    const groups = {};
    pool.forEach(p => { (groups[p.toolId || 'other'] = groups[p.toolId || 'other'] || []).push(p); });
    const rows = Object.keys(groups).filter(k => groups[k].length >= 2)
      .sort((a, b) => Math.min.apply(null, groups[a].map(p => p.price)) - Math.min.apply(null, groups[b].map(p => p.price)))
      .map(k => {
      const arr = groups[k].sort((a, b) => a.price - b.price);
      const t = TOOLS.find(x => x.id === k);
      return `<div class="ladderRow">
        <div class="lrName"><b>${esc(t ? t.name : arr[0].name)}</b><span>${arr.length} 档</span></div>
        <div class="lrTiers">${arr.map(p => `
          <div class="lrTier">
            <span class="ltName">${esc(p.tier)}</span>
            <span class="ltPrice">${money(p)}</span>
          </div>`).join('<i class="lrArrow">→</i>')}</div>
      </div>`;
    });
    box.innerHTML = rows.length ? rows.join('') : '<div class="empty">当前地区没有多档套餐。</div>';
  }

  /* =========================================================
     COMMAND PALETTE
     ========================================================= */
  function buildIndex() {
    const idx = [];
    TOOLS.forEach(t => idx.push({ k: '工具', n: t.name, d: t.vendor + ' · ' + t.tagline, go: () => openTool(t.id) }));
    PLANS.forEach(p => idx.push({ k: '套餐', n: p.name + ' ' + p.tier, d: '¥' + p.price + '/月 · ' + p.vendor, go: () => { location.hash = '#plans'; } }));
    CAP_LIST.forEach(c => idx.push({ k: '能力', n: c.name, d: c.groupName + ' · ' + c.desc, go: () => { location.hash = '#capabilities'; } }));
    (ROAD.phases || []).forEach(p => idx.push({ k: '阶段', n: p.code + ' ' + p.title, d: p.span + ' · ' + p.goal, go: () => { location.hash = '#roadmap'; } }));
    (EVS.cases || []).forEach(c => idx.push({
      k: '评测', n: c.name, d: c.id + ' · ' + c.target,
      go: () => { state.evalCat = 'all'; state.evalQ = c.id; location.hash = '#evalset'; }
    }));
    VIEWS.forEach(v => {
      if (v === '404') return;
      idx.push({ k: '页面', n: VIEW_NAME[v] || v, d: v.indexOf('mod-') === 0 ? '模块页' : '跳转', go: () => { location.hash = '#' + v; } });
    });
    /* 两个「不是页面」的入口。纠错放在命令面板里，是因为它要在任何页面都能叫出来——
       用户在套餐页看到一条错价时，不该先跑去更新日志页找按钮。 */
    idx.push({
      k: '操作', n: '报告数据错误', d: '当前页的数字不对？打开纠错表单',
      go: () => {
        const o = { title: '数据纠错' };
        const u = fixIssueUrl(o);
        if (u) { window.open(u, '_blank', 'noopener'); copyText(fixContext(o), '纠错模板已复制，可直接粘进 issue'); }
        else copyText(fixContext(o), '已复制纠错模板（本地没有关联公开仓库）');
      }
    });
    if (SITE.url && SITE.url.length > 1) {
      idx.push({
        k: '操作', n: '订阅更新（Atom）', d: '价格核验与本站改动，用阅读器订阅',
        go: () => { window.open(SITE.url + 'feed.xml', '_blank', 'noopener'); }
      });
    }
    return idx;
  }
  let IDX = [];
  let palSel = 0, palItems = [];

  function openPalette() {
    $('#palette').classList.add('on');
    const inp = $('#palInput');
    inp.value = '';
    inp.focus();
    palRender('');
  }
  function closePalette() { $('#palette').classList.remove('on'); }
  function palRender(q) {
    q = q.trim().toLowerCase();
    palItems = (q ? IDX.filter(x => (x.n + ' ' + x.d + ' ' + x.k).toLowerCase().indexOf(q) >= 0) : IDX).slice(0, 12);
    palSel = 0;
    const res = $('#palRes');
    if (!palItems.length) { res.innerHTML = '<div class="empty">没有匹配项</div>'; return; }
    res.innerHTML = palItems.map((x, i) => `
      <div class="palitem ${i === 0 ? 'on' : ''}" data-i="${i}">
        <span style="font-size:var(--fs-3)">${x.k === '工具' ? '▦' : x.k === '套餐' ? '▣' : x.k === '能力' ? '◈' : x.k === '阶段' ? '▦' : '↗'}</span>
        <span><b>${esc(x.n)}</b><br><span class="mini">${esc(x.d)}</span></span>
        <span class="k">${esc(x.k)}</span>
      </div>`).join('');
    $$('#palRes .palitem').forEach(el => {
      el.onclick = () => { closePalette(); palItems[+el.dataset.i].go(); };
      el.onmouseenter = () => { palSel = +el.dataset.i; $$('#palRes .palitem').forEach((e, j) => e.classList.toggle('on', j === palSel)); };
    });
  }
  function palKey(e) {
    if (!palItems.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); palSel = (palSel + 1) % palItems.length; }
    else if (e.key === 'ArrowUp') { e.preventDefault(); palSel = (palSel - 1 + palItems.length) % palItems.length; }
    else if (e.key === 'Enter') { e.preventDefault(); closePalette(); palItems[palSel].go(); return; }
    else return;
    $$('#palRes .palitem').forEach((el, j) => el.classList.toggle('on', j === palSel));
    const cur = $$('#palRes .palitem')[palSel];
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
  }

  /* =========================================================
     THEME
     ---------------------------------------------------------
     首屏的内联脚本已经根据 localStorage / 系统偏好设好了
     documentElement.dataset.theme，这里只负责「切换」和「记住」。
     不在这里做初始化，是为了避免页面先按深色画一遍再跳成浅色。
     ========================================================= */
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('ats_theme', t); } catch (e) {}
    const ico = $('#themeIco'), txt = $('#themeTxt');
    if (ico) ico.textContent = t === 'light' ? '☀' : '☾';
    if (txt) txt.textContent = t === 'light' ? '浅色' : '深色';
  }

  function initTheme() {
    const cur = document.documentElement.dataset.theme || 'dark';
    applyTheme(cur);
    const btn = $('#themeBtn');
    if (btn) btn.onclick = () => {
      const now = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      applyTheme(now);
      toast(now === 'light' ? '已切到浅色' : '已切到深色');
    };
  }

  /* =========================================================
     数据过期提示
     ---------------------------------------------------------
     meta.staleAfterDays 之前是死字段——定义了但没有任何代码读它，
     等于「假装有保鲜期」。现在真的会算：超过阈值就在顶部挂一条，
     并且写明「过了几天」。关掉后本次会话不再打扰。
     ========================================================= */
  function initStale() {
    const bar = $('#staleBar'), txt = $('#staleTxt'), x = $('#staleClose');
    if (!bar) return;
    const limit = Number(META.staleAfterDays) || 30;
    const last = META.lastVerified;
    if (!last) return;

    const then = new Date(last + 'T00:00:00');
    if (isNaN(then.getTime())) return;
    const days = Math.floor((Date.now() - then.getTime()) / 86400000);

    if (days > limit) {
      txt.innerHTML = `这批数据最后核验是 <b>${esc(last)}</b>，已经过去 <b>${days} 天</b>，`
        + `超过了 ${limit} 天的保鲜期。价格和额度可能已经变了，下单前请以官网为准。`;
      bar.hidden = false;
      if (x) x.onclick = () => { bar.hidden = true; };
    } else if (days > limit * 0.66) {
      // 接近过期也提示，但语气更轻
      txt.innerHTML = `数据核验于 <b>${esc(last)}</b>（${days} 天前），快到期了，近期价格可能已变动。`;
      bar.hidden = false;
      if (x) x.onclick = () => { bar.hidden = true; };
    }
  }

  /* =========================================================
     URL 状态（可分享）
     ---------------------------------------------------------
     把「矩阵权重 / 画像 / 诊断答案 / 选中的套餐」压进 hash，复制链接
     给别人就能看到一模一样的结论。只同步用户真的改过的部分：
     全默认时不写参数，保持 URL 干净。

     注意：这里不能用「拦截 state 赋值」的写法——state 是普通对象，
     所有改动都是直接赋值，没有 setter 可拦。改成在几个真正的入口
     显式调用 syncHash()。
     ========================================================= */
  let suppressSync = false;

  function stateToHash() {
    const parts = [];
    const profileOf = (id) => (CRIT.profiles || {})[id];
    // 矩阵：只在权重偏离画像默认值时才写，避免 URL 里塞一堆没改过的数
    const prof = profileOf(state.profile);
    const isDefault = prof && CRITERIA.every(c => (state.weights[c.id] || 0) === (prof.w[c.id] || 0));

    if (!isDefault) {
      parts.push('w=' + CRITERIA.map(c => state.weights[c.id] || 0).join('-'));
    }
    if (state.profile && state.profile !== 'aitest') parts.push('p=' + state.profile);
    if (state.peDone && state.peAnswers.length === PE.questions.length) {
      parts.push('pe=' + state.peAnswers.join(''));
    }
    if (state.pickedPlans && state.pickedPlans.length) {
      parts.push('pk=' + state.pickedPlans.join(','));
    }
    /* 筛选与排序也进 URL：同事发过来的「看这 12 档 Coding Plan」应该真的落到那 12 档，
       而不是落到默认视图再让他自己点一遍。只在偏离默认值时才写，避免 URL 变长。 */
    if (state.planType !== 'all') parts.push('ty=' + state.planType);
    if (state.planRegion !== 'all') parts.push('rg=' + state.planRegion);
    if (state.planSort && state.planSort.key) parts.push('so=' + state.planSort.key + '-' + state.planSort.dir);
    if (state.cmCat !== 'all') parts.push('cat=' + state.cmCat);
    if (state.cmSort !== 'pick') parts.push('cs=' + state.cmSort);
    return parts.length ? parts.join('&') : '';
  }

  function hashToState(qs) {
    if (!qs) return false;
    const p = new URLSearchParams(qs);
    let changed = false;

    // 顺序要紧：先还原画像（会把该画像的默认权重铺一遍），
    // 再用 URL 里的 w= 覆盖。反过来会先写权重再被画像冲掉。
    if (p.has('p')) {
      const id = p.get('p');
      if ((CRIT.profiles || {})[id]) { applyProfile(id); changed = true; }
    }
    if (p.has('w')) {
      const vals = p.get('w').split('-').map(Number);
      if (vals.length === CRITERIA.length && vals.every(v => !isNaN(v) && v >= 0 && v <= 10)) {
        CRITERIA.forEach((c, i) => { state.weights[c.id] = vals[i]; });
        // 权重被手改过就不再算某个画像，否则面板会显示"当前画像 X"却和滑块对不上
        state.profile = '';
        changed = true;
      }
    }
    if (p.has('pe')) {
      const a = p.get('pe').split('');
      if (a.length === PE.questions.length && PE.questions.every((q, i) => q.options.some(o => o.id === a[i]))) {
        state.peAnswers = a; state.peDone = true; changed = true;
      }
    }
    if (p.has('pk')) {
      const ids = p.get('pk').split(',').filter(id => PLANS.some(x => x.id === id));
      if (ids.length) { state.pickedPlans = ids; changed = true; }
    }
    /* 视图内的筛选状态。非法值直接忽略而不是报错——旧链接、手改的 URL
       都不该让页面崩掉，退回默认值就好。 */
    if (p.has('ty')) {
      const v = p.get('ty');
      if (['all', 'coding', 'token', 'agent', 'member', 'paygo'].indexOf(v) >= 0) { state.planType = v; changed = true; }
    }
    if (p.has('rg')) {
      const v = p.get('rg');
      if (['all', 'cn', 'global'].indexOf(v) >= 0) { state.planRegion = v; changed = true; }
    }
    if (p.has('so')) {
      const [k, d] = p.get('so').split('-');
      if (['price', 'score'].indexOf(k) >= 0 && ['asc', 'desc'].indexOf(d) >= 0) {
        state.planSort = { key: k, dir: d }; changed = true;
      }
    }
    if (p.has('cat')) {
      const v = p.get('cat');
      if (v === 'all' || CM.categories.some(c => c.id === v)) { state.cmCat = v; changed = true; }
    }
    if (p.has('cs')) {
      const v = p.get('cs');
      if (CM_SORTS.some(s => s.id === v)) { state.cmSort = v; changed = true; }
    }
    return changed;
  }

  function syncHash() {
    if (suppressSync) return;
    const extra = stateToHash();
    // 用 state.view 而不是从 hash 里反解：初始化阶段 hash 可能还是空的，
    // 从空 hash 反解会得到默认视图，写出错误的 #matrix。
    const v = state.view || location.hash.slice(1).split('?')[0] || 'overview';
    const next = extra ? '#' + v + '?' + extra : '#' + v;
    if (location.hash !== next) history.replaceState(null, '', next);
  }

  function initShare() {
    // 从 URL 恢复（必须在首次 route 之前跑完）
    const raw = location.hash.slice(1);
    const qi = raw.indexOf('?');
    if (qi >= 0) {
      suppressSync = true;
      hashToState(raw.slice(qi + 1));
      suppressSync = false;
    }

    const btn = $('#copyLink');
    if (btn) btn.onclick = async () => {
      syncHash();
      const url = location.href;
      try {
        await navigator.clipboard.writeText(url);
        toast('链接已复制，发给别人就能看到你的配置');
      } catch (e) {
        // file:// 下 clipboard 常被浏览器拒绝，退回手动复制
        window.prompt('复制这个链接（Ctrl+C）：', url);
      }
    };
  }

  /* =========================================================
     导航交互：下拉菜单 / 移动端分层导航
     ========================================================= */
  function closeDDs() {
    $$('.tddMenu').forEach(m => { m.hidden = true; });
    $$('.tddBtn').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }
  function toggleDD(btn) {
    const menu = btn.parentElement.querySelector('.tddMenu');
    if (!menu) return;
    const willOpen = menu.hidden;
    closeDDs();
    menu.hidden = !willOpen;
    btn.setAttribute('aria-expanded', String(willOpen));
  }

  let burgerEl, mnavEl;
  function openMnav() {
    if (!mnavEl) return;
    mnavEl.hidden = false;
    if (burgerEl) burgerEl.setAttribute('aria-expanded', 'true');
    const x = $('#mnavX');
    if (x) x.focus();
  }
  function closeMnav() {
    if (!mnavEl || mnavEl.hidden) return;
    mnavEl.hidden = true;
    if (burgerEl) { burgerEl.setAttribute('aria-expanded', 'false'); burgerEl.focus(); }
  }
  /* 焦点圈在面板里：Tab 到头回到开头，Shift+Tab 反向 */
  function trapTab(e, root) {
    const f = $$('a[href],button,summary,input,select', root).filter(el => !el.disabled);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* =========================================================
     站务层事件绑定
     ---------------------------------------------------------
     全部走 document 上的委托：页面上这些块会被反复重渲染，
     逐个 .onclick 会在第二次渲染后失效（元素已经是新的了）。
     ========================================================= */
  function favGo(b) {
    const k = b.dataset.fav, id = b.dataset.favId;
    return k === 'page' ? '#' + id : k === 'tool' ? '#tools' : k === 'bundle' ? '#bundles'
      : k === 'community' ? '#community' : '#home';
  }

  function bindSitePages() {
    /* 收藏按钮在**捕获阶段**处理：工具卡的点击处理器直接绑在卡元素上，
       冒泡阶段再拦已经晚了——点收藏会连带把抽屉打开。捕获阶段先吃下事件并断掉传播，
       卡片就收不到这次点击。这个坑只有真的点过才知道。 */
    document.addEventListener('click', (e) => {
      const fv = e.target.closest('[data-fav]');
      if (!fv) return;
      e.preventDefault(); e.stopPropagation();
      const on = favToggle({ k: fv.dataset.fav, id: fv.dataset.favId, n: fv.dataset.favN || fv.dataset.favId, go: favGo(fv) });
      syncFavButtons();
      toast(on ? '已收藏：' + (fv.dataset.favN || '') : '已取消收藏');
      track('fav', { k: fv.dataset.fav, id: fv.dataset.favId, on: on });
    }, true);
    document.addEventListener('click', (e) => {
      const mf = e.target.closest('[data-mfav]');
      if (mf) { e.stopPropagation(); favToggle({ k: mf.dataset.mfav, id: mf.dataset.favId }); renderMine(); return; }
      // 搜索结果 / 总览里的工具行：直接开抽屉，不跳页
      const to = e.target.closest('[data-tool-open]');
      if (to) { openTool(to.dataset.toolOpen); return; }
      // 搜索页分类
      const sq = e.target.closest('[data-sq]');
      if (sq) { SQ.cat = sq.dataset.sq; SQ.more = {}; renderSearch(); return; }
      const sm = e.target.closest('[data-sq-more]');
      if (sm) { SQ.more = SQ.more || {}; SQ.more[sm.dataset.sqMore] = true; renderSearch(); return; }
      // 反馈：类型切换 / 复制 / 删除 / 从某个功能页带过来
      const fk = e.target.closest('[data-fb]');
      if (fk) { FBST.kind = fk.dataset.fb; renderFeedback(); return; }
      const fc = e.target.closest('[data-fb-copy]');
      if (fc) {
        const l = lsGet(LS.fb, []) || [];
        const it = l[+fc.dataset.fbCopy];
        if (it) copyText(it.text, '已复制这一条');
        return;
      }
      const fd = e.target.closest('[data-fb-del]');
      if (fd) {
        const l = lsGet(LS.fb, []) || [];
        l.splice(+fd.dataset.fbDel, 1); lsSet(LS.fb, l); renderFbSaved();
        return;
      }
      const fp = e.target.closest('[data-fb-page]');
      if (fp) {
        // 从功能页底部过来：类型设成「报错」，并把页名带进「位置」
        FBST.kind = 'bug';
        FBST.prefill = VIEW_NAME[fp.dataset.fbPage] || fp.dataset.fbPage;
        return;
      }
      // 个人中心：导出 / 清空
      if (e.target.closest('#mineExport')) {
        const payload = {
          exportedAt: new Date().toISOString(),
          site: { version: META.version, url: SITE.url || '', verified: META.lastVerified || '' },
          fav: FAV, recent: RECENT,
          stack: state.pickedTools, plans: state.pickedPlans,
          diag: lsGet(LS.diag, []), fb: lsGet(LS.fb, [])
        };
        const blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'ats-my-data.json';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        toast('已导出 ats-my-data.json');
        track('mine_export');
        return;
      }
      if (e.target.closest('#mineClear')) {
        if (!window.confirm('清空这台设备上的收藏、浏览历史、组合与诊断记录？\n\n这个动作不能撤销——站点没有任何你的副本，所以也没有云端备份可恢复。')) return;
        [LS.fav, LS.recent, LS.stack, LS.picked, LS.diag, LS.events, LS.fb, LS.plan, LS.planprog]
          .forEach(k => { try { localStorage.removeItem(k); } catch (err) {} });
        FAV.length = 0; RECENT.length = 0;
        state.pickedTools = []; state.pickedPlans = [];
        renderMine(); toast('已清空本机数据');
        track('mine_clear');
        return;
      }
      if (e.target.closest('#errCopy')) {
        const et = $('#errTrace');
        copyText(et ? et.textContent : '', '技术细节已复制，贴进 issue 即可');
      }
    });

    // 搜索输入
    const sqi = $('#siteQ');
    if (sqi) {
      let tmr;
      sqi.oninput = () => {
        SQ.q = sqi.value; SQ.more = {};
        clearTimeout(tmr);
        tmr = setTimeout(() => { renderSearch(); if (SQ.q.trim()) track('search', { q: SQ.q.slice(0, 24) }); }, 90);
      };
      sqi.onkeydown = (e) => {
        if (e.key === 'Escape') { sqi.value = ''; SQ.q = ''; renderSearch(); }
        if (e.key === 'Enter') { const f = $('#siteQBody .sresRow'); if (f) f.click(); }
      };
    }

    // 反馈表单：输入即更新预览
    ['fbWhere', 'fbText'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.oninput = () => { const p = $('#fbPreview'); if (p) p.textContent = fbText(); };
    });
    const fbo = $('#fbOpen');
    if (fbo) fbo.onclick = () => {
      const u = fbUrl();
      copyText(fbText(), u ? '模板已复制，粘进打开的 issue 即可' : '本地没有关联仓库，模板已复制');
      if (u) { window.open(u, '_blank', 'noopener'); track('feedback_open', { k: FBST.kind }); }
    };
    const fbc = $('#fbCopy');
    if (fbc) fbc.onclick = () => { copyText(fbText(), '反馈模板已复制'); track('feedback_copy', { k: FBST.kind }); };
    const fbs = $('#fbSave');
    if (fbs) fbs.onclick = () => {
      const list = lsGet(LS.fb, []) || [];
      const cur = FB_KINDS.find(x => x.k === FBST.kind) || FB_KINDS[0];
      list.unshift({ kind: FBST.kind, kindName: cur.n, t: Date.now(), text: fbText() });
      while (list.length > 30) list.pop();
      lsSet(LS.fb, list); renderFbSaved(); toast('已在这台设备上留一份');
    };
  }

  /* =========================================================
     INIT
     ========================================================= */
  function init() {
    IDX = buildIndex();
    // 导航先渲染：顶栏/页脚/移动端的结构由 data/nav.json 决定，
    // 必须在首次 route 之前替换，否则第一次进站看到的是模板里的旧结构。
    renderNav();
    bindSitePages();

    // 这三个必须在首次渲染之前跑：
    // initShare 从 URL 恢复权重/画像/诊断答案/选中套餐，
    // 晚于渲染就会先闪一版默认值。
    initShare();
    initTheme();
    initStale();

    // 站内跳转统一在 document 上捕获：埋点 + 收起移动导航/下拉
    document.addEventListener('click', (e) => {
      const ddBtn = e.target.closest('.tddBtn');
      if (ddBtn) { toggleDD(ddBtn); return; }
      if (!e.target.closest('.tdd')) closeDDs();
      const a = e.target.closest('a[href^="#"]');
      if (a) {
        const to = a.getAttribute('href').slice(1).split('?')[0];
        if (to) track('go', { to, from: state.view });
        closeMnav();
      }
    });

    // 顶栏工具按钮
    const pb = $('#palBtn');
    if (pb) pb.onclick = openPalette;

    // 回到顶部：滚动 600px 后出现；点击平滑回顶
    const bt = $('#backTop');
    if (bt) {
      bt.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
      const syncBt = () => bt.classList.toggle('on', window.scrollY > 600);
      window.addEventListener('scroll', syncBt, { passive: true });
      syncBt();
    }

    // 移动端分层导航：主链接 → 模块 accordion → 功能链接
    burgerEl = $('#burger');
    mnavEl = $('#mnav');
    if (burgerEl && mnavEl) {
      burgerEl.onclick = () => { mnavEl.hidden ? openMnav() : closeMnav(); };
      const mx = $('#mnavX');
      if (mx) mx.onclick = closeMnav;
      mnavEl.addEventListener('keydown', (e) => { if (e.key === 'Tab') trapTab(e, mnavEl); });
      const mods = $('#mnavMods');
      if (mods) mods.innerHTML = IA.filter(p => p.id !== 'home').map(p => `
        <details class="mmod">
          <summary><span class="mic" aria-hidden="true">▸</span>${esc(p.name)}<span class="mcnt">${(p.secs || []).length}</span></summary>
          <div class="mmodLinks"><a href="#${p.id}">进入${esc(p.name)}</a>${(p.secs || []).map(([s, label]) => `<a href="#${p.id}?sec=${s}">${esc(label)}</a>`).join('')}</div>
        </details>`).join('');
    }

    // tool search
    const ts = $('#toolSearch');
    if (ts) ts.oninput = () => { state.toolQuery = ts.value; renderTools(); };

    // drawer close
    const scrim = $('#scrim');
    if (scrim) scrim.onclick = closeDrawer;

    // palette
    const pi = $('#palInput');
    if (pi) { pi.oninput = () => palRender(pi.value); pi.onkeydown = palKey; }
    const pal = $('#palette');
    if (pal) pal.onclick = (e) => { if (e.target === pal) closePalette(); };

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeDrawer(); closePalette(); closeMnav(); closeDDs(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
    });

    // meta
    const mv = $('#metaVer'); if (mv) mv.textContent = 'v' + (META.version || '—');
    const sv = $('#sfVer'); if (sv) sv.textContent = 'v' + (META.version || '—');
    const md = $('#metaDate'); if (md) md.textContent = META.lastVerified || '—';

    // 引导层先渲染一遍：打印「全部页面」和命令面板不依赖用户先走到那一页
    renderHome();
    render404();

    renderOverview();
    renderHeat('#ovHeat', true);
    renderSources();
    renderRoadmap();
    renderChangelog();
    renderHomeChanges();
    renderSiteLinks();
    route();

    /* 离线缓存：网页版也留一份，断网或地铁里还能看。
       file:// 下浏览器不允许注册 SW —— 但那本来就是「文件全在硬盘上」的场景，不需要。
       sw.js 由 scripts/build-site.js 生成，开发时（仓库根目录直接开）不存在，注册失败也无所谓。 */
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register((SITE.base || '') + '/sw.js').catch(() => {});
      });
    }

    // 首屏已渲染完，揭开骨架；淡出结束后把节点摘掉，免得它一直挂在 DOM 里
    document.documentElement.classList.add('ready');
    setTimeout(() => { const b = document.getElementById('boot'); if (b) b.remove(); }, 320);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
