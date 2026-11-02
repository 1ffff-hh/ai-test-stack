const { launch } = require('./browser');
const path = require('path');
const BASE = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
// 26 个视图 = 16 个功能页 + home/map/all + 6 个模块页 + 404
const VIEWS = ['home','overview','report','matrix','tools','capabilities','plans','promos','free','bundles','persona','aitest','events','news','impact','roles','evalset','versus','roadmap','stack','plan','opinion','changelog','sources','health','map','all','mod-start','mod-diagnose','mod-grow','mod-shift','mod-toolkit','mod-choose','mod-data','404'];

async function fresh(browser, hash = '') {
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(BASE + hash, { waitUntil: 'load' });
  await p.waitForTimeout(450);
  return { c, p, errs };
}

(async () => {
  const browser = await launch();
  const out = {};
  const allErrs = [];

  // ---------- 1. 15 个页面 ----------
  {
    const { c, p, errs } = await fresh(browser);
    const views = {};
    for (const v of VIEWS) {
      await p.evaluate(v => { location.hash = '#' + v; }, v);
      await p.waitForTimeout(150);
      views[v] = await p.evaluate(v => {
        const on = document.querySelector('.view.on');
        return on && on.id === 'v-' + v ? on.querySelectorAll('*').length : -1;
      }, v);
    }
    out.viewsOk = Object.entries(views).every(([, n]) => n > 20);
    out.views = views;
    allErrs.push(...errs);
    await c.close();
  }

  // ---------- 2. 主题往返 ----------
  {
    const { c, p, errs } = await fresh(browser);
    const t0 = await p.evaluate(() => document.documentElement.dataset.theme);
    await p.click('#themeBtn'); await p.waitForTimeout(180);
    const t1 = await p.evaluate(() => document.documentElement.dataset.theme);
    await p.click('#themeBtn'); await p.waitForTimeout(180);
    const t2 = await p.evaluate(() => document.documentElement.dataset.theme);
    out.themeOk = t0 !== t1 && t0 === t2;
    out.theme = { t0, t1, t2 };
    allErrs.push(...errs);
    await c.close();
  }

  // ---------- 3. 抽屉（键盘打开 → 焦点入内 → Esc → 焦点回来） ----------
  {
    const { c, p, errs } = await fresh(browser, '#tools');
    await p.evaluate(() => document.querySelector('#tgrid .tcard').focus());
    await p.keyboard.press('Enter');
    await p.waitForTimeout(400);
    const onOpen = await p.evaluate(() => {
      const d = document.querySelector('#drawer');
      return { open: d.classList.contains('on'), ariaHidden: d.getAttribute('aria-hidden'), caps: d.querySelectorAll('.sb').length, focusId: document.activeElement.id };
    });
    await p.keyboard.press('Escape');
    await p.waitForTimeout(400);
    const afterEsc = await p.evaluate(() => {
      const d = document.querySelector('#drawer');
      return { open: d.classList.contains('on'), ariaHidden: d.getAttribute('aria-hidden'), focusCls: (document.activeElement.className || '').toString() };
    });
    // 关闭状态下 Tab 不应落进抽屉
    let hits = 0;
    for (let i = 0; i < 18; i++) {
      await p.keyboard.press('Tab');
      if (await p.evaluate(() => !!(document.activeElement && document.activeElement.closest && document.activeElement.closest('#drawer')))) hits++;
    }
    out.drawer = { onOpen, afterEsc, tabHitsWhenClosed: hits };
    allErrs.push(...errs);
    await c.close();
  }

  // ---------- 4. 首屏第一个 Tab 是「跳到主内容」 ----------
  {
    const { c, p, errs } = await fresh(browser);
    await p.keyboard.press('Tab'); await p.waitForTimeout(200);
    out.skipFocus = await p.evaluate(() => {
      const a = document.activeElement;
      return { tag: a.tagName, cls: (a.className || '').toString(), text: (a.textContent || '').trim(), left: getComputedStyle(a).left };
    });
    allErrs.push(...errs);
    await c.close();
  }

  // ---------- 5. 打印媒体 ----------
  {
    const { c, p, errs } = await fresh(browser);
    await p.emulateMedia({ media: 'print' });
    await p.waitForTimeout(250);
    out.print = await p.evaluate(() => ({
      chrome: getComputedStyle(document.querySelector('.topbar')).display,
      viewsShown: Array.from(document.querySelectorAll('.view')).filter(v => getComputedStyle(v).display !== 'none').length,
      current: !!document.querySelector('.view.on')
    }));
    out.printOk = out.print.chrome === 'none' && out.print.viewsShown === 1 && out.print.current;
    allErrs.push(...errs);
    await c.close();
  }

  // ---------- 6. 三档视口 ----------
  {
    const { c, p, errs } = await fresh(browser);
    const ov = {};
    for (const [w, h] of [[1440, 900], [820, 1000], [390, 844]]) {
      await p.setViewportSize({ width: w, height: h });
      await p.waitForTimeout(220);
      ov[w] = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    }
    out.overflow = ov;
    out.overflowOk = Object.values(ov).every(Boolean);
    allErrs.push(...errs);
    await c.close();
  }

  // ---------- 7. 四条深链 ----------
  const links = {
    geek: ['#matrix?p=geek', () => (document.querySelector('.rrow .rn') || {}).textContent],
    weights: ['#matrix?w=0-7-9-7-6-9-10-6-4', () => (document.querySelector('.rrow .rn') || {}).textContent],
    persona: ['#persona?pe=aaaa', () => (document.querySelector('#peResult .peName') || {}).textContent],
    plan: ['#plans?pk=dsapi', () => document.querySelectorAll('#planBody tr.picked').length]
  };
  out.links = {};
  for (const [k, [hash, fn]] of Object.entries(links)) {
    const { c, p, errs } = await fresh(browser, hash);
    out.links[k] = await p.evaluate(fn);
    allErrs.push(...errs.filter(e => !e.includes('favicon')));
    await c.close();
  }

  // ---------- 8. 引导路径：首页 CTA → 地图 → 模块 → 功能 → 查看更多 ----------
  {
    const { c, p, errs } = await fresh(browser);
    const home = await p.evaluate(() => ({
      on: document.querySelector('#v-home').classList.contains('on'),
      h1: (document.querySelector('#v-home h1') || {}).textContent || '',
      ctas: document.querySelectorAll('#v-home .ctaRow a').length,
      mods: document.querySelectorAll('#homeMods .mcard').length
    }));
    await p.click('#v-home .ctaRow a.primary');
    await p.waitForTimeout(300);
    const step1 = await p.evaluate(() => location.hash);
    await p.evaluate(() => { location.hash = '#map'; });
    await p.waitForTimeout(300);
    const mapCards = await p.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('#mapBody .mcard'));
      return { total: cards.length, modLinks: cards.filter(a => (a.getAttribute('href') || '').indexOf('#mod-') === 0).length };
    });
    await p.click('#mapBody .mcard');
    await p.waitForTimeout(300);
    const modHash = await p.evaluate(() => location.hash);
    await p.click('#v-mod-start .fgrid .fcard');
    await p.waitForTimeout(300);
    const feat = await p.evaluate(() => ({
      hash: location.hash,
      subnav: !document.querySelector('#subnav').hidden,
      crumbs: document.querySelectorAll('#subnav .crumbs a, #subnav .crumbs b').length,
      guide: !!document.querySelector('.pguide')
    }));
    await p.click('.pguide .gmore .btn.primary');
    await p.waitForTimeout(300);
    const more = await p.evaluate(() => location.hash);
    out.flow = { home, step1, mapCards, modHash, feat, more };
    out.flowOk = home.on && home.ctas === 2 && home.mods === 8
      && step1 === '#persona' && mapCards.total === 8 && mapCards.modLinks === 7
      && modHash === '#mod-start' && feat.hash === '#overview'
      && feat.subnav && feat.crumbs >= 3 && feat.guide && more === '#all';
    allErrs.push(...errs);
    await c.close();
  }

  // ---------- 9. 移动端分层导航：汉堡 → 主面板 → 模块 accordion → 功能 ----------
  {
    const { c, p, errs } = await fresh(browser);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.waitForTimeout(250);
    const burgerVisible = await p.evaluate(() => getComputedStyle(document.querySelector('#burger')).display !== 'none');
    await p.click('#burger');
    await p.waitForTimeout(300);
    const opened = await p.evaluate(() => !document.querySelector('#mnav').hidden);
    const mods = await p.evaluate(() => document.querySelectorAll('#mnavMods .mmod').length);
    await p.click('#mnavMods .mmod:nth-child(2) summary');
    await p.waitForTimeout(200);
    await p.click('#mnavMods .mmod:nth-child(2) .mmodLinks a');
    await p.waitForTimeout(300);
    const after = await p.evaluate(() => ({ hash: location.hash, closed: document.querySelector('#mnav').hidden }));
    out.mobileNav = { burgerVisible, opened, mods, ...after };
    out.mobileNavOk = burgerVisible && opened && mods === 7 && after.closed && after.hash === '#persona';
    allErrs.push(...errs);
    await c.close();
  }

  // ---------- 10. 未知地址 → 404（带 16 个入口）；标题跟随视图 ----------
  {
    const { c, p, errs } = await fresh(browser, '#no-such-page');
    const nf = await p.evaluate(() => ({
      on: document.querySelector('#v-404').classList.contains('on'),
      links: document.querySelectorAll('#nfLinks a').length,
      title: document.title
    }));
    await p.evaluate(() => { location.hash = '#tools'; });
    await p.waitForTimeout(250);
    const t2 = await p.evaluate(() => document.title);
    out.notFound = { ...nf, toolsTitle: t2 };
    out.notFoundOk = nf.on && nf.links === 24 && nf.title.indexOf('页面不存在') >= 0 && t2.indexOf('工具库') >= 0;
    allErrs.push(...errs);
    await c.close();
  }

  // ---------- 11. 完整工具站 = 直接总览控制台：16 格平铺全直达 + 搜索 + 模块筛选 ----------
  {
    const { c, p, errs } = await fresh(browser, '#all');
    const base = await p.evaluate(vs => ({
      kpi: document.querySelectorAll('#allKpis .akpi').length,
      cards: document.querySelectorAll('#allBody .srow').length,
      data: document.querySelectorAll('#allData .dcard').length,
      // 每格都必须是功能页直达链接，不允许出现「下一层目录」
      direct: Array.from(document.querySelectorAll('#allBody .srow'))
        .every(a => vs.indexOf((a.getAttribute('href') || '').slice(1)) >= 0)
    }), VIEWS);
    await p.fill('#allSearch', '诊断');
    await p.waitForTimeout(250);
    const afterQ = await p.evaluate(() => document.querySelectorAll('#allBody .srow').length);
    await p.fill('#allSearch', '');
    await p.waitForTimeout(200);
    await p.click('#allMods .preset[data-am="diagnose"]');
    await p.waitForTimeout(250);
    const afterMod = await p.evaluate(() => ({
      n: document.querySelectorAll('#allBody .srow').length,
      on: (document.querySelector('#allMods .preset.on') || {}).dataset ? document.querySelector('#allMods .preset.on').dataset.am : ''
    }));
    await p.click('#allBody .srow');
    await p.waitForTimeout(300);
    const jump = await p.evaluate(() => location.hash);
    out.console = { base, afterQ, afterMod, jump };
    out.consoleOk = base.kpi >= 5 && base.cards === 24 && base.direct && base.data >= 2
      && afterQ > 0 && afterQ < 24 && afterMod.n === 4 && afterMod.on === 'diagnose'
      && jump === '#persona';
    allErrs.push(...errs);
    await c.close();
  }

  // ---------- 12. 首页诊断台：3 问出方案 + 存档进我的组合 ----------
  {
    const { c, p, errs } = await fresh(browser);
    const boot = await p.evaluate(() => ({
      log: document.querySelectorAll('#dlog .dmsg').length,
      chips: document.querySelectorAll('#dopts .dchip').length
    }));
    await p.click('#dopts .dchip[data-v="regress"]');
    await p.waitForTimeout(900);
    await p.click('#dopts .dchip[data-v="100"]');
    await p.waitForTimeout(900);
    await p.click('#dopts .dchip[data-v="cn"]');
    await p.waitForTimeout(1900); // 输入中 + 生成动画 + 报告渲染
    const rep = await p.evaluate(() => {
      const r = document.querySelector('.dreport');
      return {
        on: !!r,
        price: /¥\d+/.test(r ? r.textContent : ''),
        stamp: !!document.querySelector('.dstamp'),
        acts: r ? r.querySelectorAll('.drActs a, .drActs button').length : 0,
        // 成本拆解必须自证：壳 + 电 = 合计，不许出现 60+40 却写 40 的错账
        sums: (function () {
          const c = Array.from(document.querySelectorAll('.dcost b')).map(x => parseInt(x.textContent.replace(/[^0-9]/g, ''), 10));
          return { cells: c.length, ok: c.length === 3 && c[0] + c[1] === c[2], v: c };
        })(),
        quota: !!document.querySelector('.drrow i.ok, .drrow i.warn, .drrow i.bad'),
        up: Array.from(document.querySelectorAll('.drrow i')).some(i => i.textContent === '升级')
      };
    });
    await p.click('.dreport [data-save]');
    await p.waitForTimeout(250);
    const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('ats_diag') || '[]').length);
    await p.evaluate(() => { location.hash = '#stack'; });
    await p.waitForTimeout(450);
    const recs = await p.evaluate(() => ({
      n: document.querySelectorAll('#stackDiag .drec').length,
      adopt: !!document.querySelector('#stackDiag [data-adopt]')
    }));
    out.diag = { boot, rep, saved, recs };
    out.diagOk = boot.chips === 4 && rep.on && rep.price && rep.stamp && rep.acts === 4
      && rep.sums.ok && rep.quota && rep.up
      && saved === 1 && recs.n >= 1 && recs.adopt;
    allErrs.push(...errs);
    await c.close();
  }

  // ---------- 13. 执行包：空态 → 从诊断生成 → 4 周 10 个动作 → 勾选持久化 ----------
  {
    const { c, p, errs } = await fresh(browser, '#plan');
    const empty = await p.evaluate(() => ({
      on: !document.querySelector('#ppEmpty').hidden,
      hasCta: !!document.querySelector('#ppEmpty a[href="#home"]'),
      grid: document.querySelector('#ppGrid').hidden
    }));
    // 回首页答完三问，点「生成执行包」
    await p.evaluate(() => { location.hash = '#home'; });
    await p.waitForTimeout(250);
    for (const v of ['regress', '100', 'cn']) {
      await p.click(`#dopts .dchip[data-v="${v}"]`);
      await p.waitForTimeout(1600);
    }
    await p.click('#dlog [data-goplan]');
    await p.waitForTimeout(700);
    const built = await p.evaluate(() => ({
      hash: location.hash,
      weeks: document.querySelectorAll('#ppBody .week').length,
      tasks: document.querySelectorAll('#ppBody .task').length,
      accs: document.querySelectorAll('#ppBody .task .acc').length,
      sum: (document.querySelector('#ppSum') || {}).textContent || '',
      code: document.querySelectorAll('#ppBody .ppCode pre').length,
      exp: !!document.querySelector('#ppSide [data-expmd]')
    }));
    // 勾第一个动作，再刷新看是否还在
    await p.click('#ppBody .task');
    await p.waitForTimeout(250);
    const tick1 = await p.evaluate(() => ({
      n: JSON.parse(localStorage.getItem('ats_planprog') || '{}')[Object.keys(JSON.parse(localStorage.getItem('ats_planprog') || '{}'))[0]] || [],
      done: document.querySelectorAll('#ppBody .task.done').length,
      prog: (document.querySelector('#ppSide .prog b') || {}).textContent || ''
    }));
    await p.reload({ waitUntil: 'load' });
    await p.waitForTimeout(600);
    const afterReload = await p.evaluate(() => document.querySelectorAll('#ppBody .task.done').length);
    out.plan = { empty, built, tick1, afterReload };
    out.planOk = empty.on && empty.hasCta && empty.grid
      && built.hash === '#plan' && built.weeks === 4 && built.tasks === 10 && built.accs === 10
      && /¥\d+/.test(built.sum) && built.code === 1 && built.exp
      && tick1.n.length === 1 && tick1.done === 1 && afterReload === 1;
    allErrs.push(...errs);
    await c.close();
  }

  // ---------- 14. 采纳闭环：壳 + 电一起落进「我的组合」 ----------
  {
    const { c, p, errs } = await fresh(browser);
    for (const v of ['regress', '100', 'cn']) {
      await p.click(`#dopts .dchip[data-v="${v}"]`);
      await p.waitForTimeout(1600);
    }
    const bId = await p.evaluate(() => {
      const btn = document.querySelector('#dlog [data-save]');
      return btn ? btn.closest('.dreport').querySelector('.drn b, .drn').textContent.trim() : '';
    });
    await p.click('#dlog [data-save]');
    await p.waitForTimeout(300);
    const st = await p.evaluate(() => ({
      tools: JSON.parse(localStorage.getItem('ats_stack') || '[]'),
      plans: JSON.parse(localStorage.getItem('ats_picked') || '[]'),
      label: (document.querySelector('#dlog [data-save]') || {}).textContent || ''
    }));
    await p.evaluate(() => { location.hash = '#stack'; });
    await p.waitForTimeout(500);
    const stack = await p.evaluate(() => ({
      picked: document.querySelectorAll('#stackPlans .pk.on').length,
      total: (document.querySelector('#stackTotal') || {}).textContent || ''
    }));
    out.adopt = { bId, st, stack };
    out.adoptOk = st.tools.length === 1 && st.plans.length === 1 && /已采纳/.test(st.label)
      && stack.picked === 1 && /¥/.test(stack.total);
    allErrs.push(...errs);
    await c.close();
  }

  // ---------- 15. AI 大事：人工/自动分离、地区与类型筛选、来源可点 ----------
  {
    const { c, p, errs } = await fresh(browser, '#news');
    const base = await p.evaluate(() => ({
      n: document.querySelectorAll('#newsList .nitem').length,
      manual: document.querySelectorAll('#newsList .nitem:not(.is-auto)').length,
      autoOn: document.querySelector('#newsAutoToggle').checked,
      kinds: document.querySelectorAll('#newsKind .seg').length,
      srcOk: Array.from(document.querySelectorAll('#newsList .nfoot a')).every(a => /^https?:/.test(a.href)),
      impact: document.querySelectorAll('#newsList .nimpact').length
    }));
    await p.click('#newsRegion .seg[data-r="cn"]');
    await p.waitForTimeout(200);
    const cn = await p.evaluate(() => document.querySelectorAll('#newsList .nitem').length);
    await p.click('#newsKind .seg[data-k="policy"]');
    await p.waitForTimeout(200);
    const policy = await p.evaluate(() => ({
      n: document.querySelectorAll('#newsList .nitem').length,
      allCn: Array.from(document.querySelectorAll('#newsList .nreg')).every(x => x.textContent === '国内')
    }));
    out.news = { base, cn, policy };
    out.newsOk = base.n >= 30 && base.manual >= 30 && !base.autoOn
      && base.kinds >= 7 && base.srcOk && base.impact === base.n
      && cn > 0 && cn < base.n && policy.n > 0 && policy.allCn;
    allErrs.push(...errs);
    await c.close();
  }

  // ---------- 16. AI 冲击：数据块 / 替代度矩阵 / 90 天 / 自检 ----------
  {
    const { c, p, errs } = await fresh(browser, '#impact');
    const base = await p.evaluate(() => ({
      nums: document.querySelectorAll('#impNums .numBlock').length,
      rows: document.querySelectorAll('#impMatrix tbody tr').length,
      phases: document.querySelectorAll('#impPlaybook .phase').length,
      anti: document.querySelectorAll('#impAnti .anti').length,
      checks: document.querySelectorAll('#impCheck input[data-i]').length,
      band: (document.querySelector('#impCheck .ckName') || {}).textContent || ''
    }));
    // 每勾一次都会重绘（带进度反馈），必须逐次重新取节点
    for (let i = 0; i < 5; i++) {
      await p.evaluate(i => { const el = document.querySelector(`#impCheck input[data-i="${i}"]`); if (el) el.click(); }, i);
      await p.waitForTimeout(70);
    }
    await p.waitForTimeout(180);
    const after = await p.evaluate(() => ({
      on: document.querySelectorAll('#impCheck .ck.on').length,
      score: (document.querySelector('#impCheck .ckScore b') || {}).textContent || '',
      band: (document.querySelector('#impCheck .ckName') || {}).textContent || ''
    }));
    out.impact = { base, after };
    out.impactOk = base.nums === 8 && base.rows >= 9 && base.phases === 3 && base.anti >= 6
      && base.checks === 5 && after.on === 5 && after.score === '5' && /规模化/.test(after.band);
    allErrs.push(...errs);
    await c.close();
  }

  // ---------- 17. 角色阶梯：四象限 / 三阶段 / 7 卡 / 详情切换 / 三级矩阵 ----------
  {
    const { c, p, errs } = await fresh(browser, '#roles');
    const base = await p.evaluate(() => ({
      quads: document.querySelectorAll('#roleQuad .quad').length,
      stages: document.querySelectorAll('#roleStages .stageTab').length,
      cards: document.querySelectorAll('#roleList .roleCard').length,
      title: (document.querySelector('#roleDetail h2') || {}).textContent || '',
      levels: document.querySelectorAll('#roleLevels .lvCard').length,
      matrix: document.querySelectorAll('#roleMatrix tbody tr').length
    }));
    await p.click('#roleList .roleCard[data-r="whitebox"]');
    await p.waitForTimeout(220);
    const switched = await p.evaluate(() => ({
      title: (document.querySelector('#roleDetail h2') || {}).textContent || '',
      tools: document.querySelectorAll('#roleDetail .toolChip').length
    }));
    await p.click('#roleStages .stageTab[data-s="3"]');
    await p.waitForTimeout(220);
    const stage3 = await p.evaluate(() => ({
      cards: document.querySelectorAll('#roleList .roleCard').length,
      title: (document.querySelector('#roleDetail h2') || {}).textContent || ''
    }));
    out.roles = { base, switched, stage3 };
    out.rolesOk = base.quads === 4 && base.stages === 3 && base.cards === 7
      && /黑盒/.test(base.title) && base.levels === 3 && base.matrix === 7
      && /白盒/.test(switched.title) && switched.tools >= 2
      && stage3.cards === 2 && /AI/.test(stage3.title);
    allErrs.push(...errs);
    await c.close();
  }

  // ---------- 18. 白嫖地图：分类/地区筛选、过期条目、每条都有坑 ----------
  {
    const { c, p, errs } = await fresh(browser, '#free');
    const base = await p.evaluate(() => ({
      n: document.querySelectorAll('#freeGrid .freeCard').length,
      expired: document.querySelectorAll('#freeGrid .freeCard.expired').length,
      cats: document.querySelectorAll('#freeCat .seg').length,
      regs: document.querySelectorAll('#freeRegion .seg').length,
      traps: Array.from(document.querySelectorAll('#freeGrid .fcTrap p')).every(x => x.textContent.trim().length >= 15)
    }));
    await p.click('#freeCat .seg[data-c="agent"]');
    await p.waitForTimeout(200);
    const agent = await p.evaluate(() => document.querySelectorAll('#freeGrid .freeCard').length);
    await p.click('#freeRegion .seg[data-r="cn"]');
    await p.waitForTimeout(200);
    const agentCn = await p.evaluate(() => document.querySelectorAll('#freeGrid .freeCard').length);
    out.free = { base, agent, agentCn };
    out.freeOk = base.n >= 30 && base.expired >= 1 && base.cats === 5 && base.regs === 3
      && base.traps && agent > 0 && agent < base.n && agentCn > 0 && agentCn < agent;
    allErrs.push(...errs);
    await c.close();
  }

  // ---------- 19. 套餐：默认 20 行 → 展开全部 → 地区筛选与币种 ----------
  {
    const { c, p, errs } = await fresh(browser, '#plans');
    const first = await p.evaluate(() => document.querySelectorAll('#planBody tr').length);
    await p.click('#pMore');
    await p.waitForTimeout(250);
    const all = await p.evaluate(() => ({
      rows: document.querySelectorAll('#planBody tr').length,
      usd: Array.from(document.querySelectorAll('#planBody .pr')).some(x => /\$/.test(x.textContent)),
      restr: document.querySelectorAll('#planBody .restr').length
    }));
    await p.click('#pRegion .seg[data-r="cn"]');
    await p.waitForTimeout(250);
    const cn = await p.evaluate(() => ({
      rows: document.querySelectorAll('#planBody tr').length,
      noUsd: !Array.from(document.querySelectorAll('#planBody .pr')).some(x => /\$/.test(x.textContent))
    }));
    out.plans2 = { first, all, cn };
    out.plans2Ok = first === 20 && all.rows > 40 && all.usd && all.restr > 5
      && cn.rows > 10 && cn.rows < all.rows && cn.noUsd;
    allErrs.push(...errs);
    await c.close();
  }

  // ---------- 20. 数据不变量：新数据集必须完整，且页面数字与数据一致 ----------
  {
    const { c, p, errs } = await fresh(browser);
    const inv = await p.evaluate(() => {
      const D = window.__DATA__;
      const T = D.tools, P = D.plans, B = D.bundles, F = D.freebies.items, N = D.news.events, R = D.roles.roles;
      const E = D.evalset.cases || [];
      return {
        tools: T.length, plans: P.length, bundles: B.length, free: F.length, news: N.length, roles: R.length, evalset: E.length,
        kindOk: T.every(t => ['shell', 'qa'].indexOf(t.kind) >= 0 && ['cn', 'global'].indexOf(t.region) >= 0),
        planOk: P.every(x => ['cn', 'global'].indexOf(x.region) >= 0 && ['CNY', 'USD'].indexOf(x.currency) >= 0 && typeof x.price === 'number'),
        freeOk: F.every(x => x.trap && x.trap.length >= 15 && /^\d{4}-\d{2}-\d{2}$/.test(x.verified)),
        newsOk: N.every(x => /^https?:\/\//.test(x.source.url) && x.impact && x.impact.length >= 10),
        roleOk: R.every(x => x.work.length && x.aiUse.length && x.human.length && x.metrics.length && x.tools.length),
        evalOk: E.every(x => x.input && x.expected && x.oracle && ['P0', 'P1', 'P2'].indexOf(x.severity) >= 0),
        quad: D.roles.relation.quads.length,
        levels: D.roles.levels.length
      };
    });
    const home = await p.evaluate(() => ({
      hc: (document.querySelector('#hCounts') || {}).textContent || '',
      feats: (document.querySelector('#rdFeats') || {}).dataset.n,
      tools: (document.querySelector('#rdTools') || {}).dataset.n
    }));
    out.inv = { inv, home };
    out.invOk = inv.tools >= 28 && inv.plans >= 50 && inv.bundles >= 30 && inv.free >= 30
      && inv.news >= 30 && inv.roles >= 10 && inv.evalset === 30 && inv.kindOk && inv.planOk && inv.freeOk
      && inv.newsOk && inv.roleOk && inv.evalOk && inv.quad === 4 && inv.levels === 3
      && home.feats === '24' && String(inv.tools) === home.tools;
    allErrs.push(...errs);
    await c.close();
  }

  // ---------- 21. 数据健康：四张卡、待办、失败源、六个导出 ----------
  {
    const { c, p, errs } = await fresh(browser, '#health');
    const base = await p.evaluate(() => ({
      cards: document.querySelectorAll('#healthGrid .hcard').length,
      queue: document.querySelectorAll('#healthQueue .hrow').length,
      fails: document.querySelectorAll('#healthSources .hfail').length,
      exports: document.querySelectorAll('#healthExports .exportBtn').length,
      status: (document.querySelector('#healthMeta') || {}).textContent || '',
      queueBtn: !!document.querySelector('#healthCopyTodo')
    }));
    out.health = base;
    out.healthOk = base.cards === 4 && base.queue > 0 && base.fails > 0
      && base.exports === 6 && /状态/.test(base.status) && base.queueBtn;
    allErrs.push(...errs);
    await c.close();
  }

  // ---------- 22. AI 评测集：30 条、7 个筛选、P0 计数、搜索 ----------
  {
    const { c, p, errs } = await fresh(browser, '#evalset');
    const base = await p.evaluate(() => ({
      cards: document.querySelectorAll('#evalGrid .evalCard').length,
      cats: document.querySelectorAll('#evalCats .seg').length,
      stats: document.querySelectorAll('#evalStats .es').length,
      p0: document.querySelectorAll('#evalGrid .ecSev.p0').length,
      json: (document.querySelector('#evalJSON') || {}).textContent || ''
    }));
    await p.click('#evalCats .seg[data-ecat="security"]');
    await p.waitForTimeout(180);
    const security = await p.evaluate(() => document.querySelectorAll('#evalGrid .evalCard').length);
    await p.click('#evalCats .seg[data-ecat="all"]');
    await p.fill('#evalSearch', '注入');
    await p.waitForTimeout(180);
    const searched = await p.evaluate(() => ({
      n: document.querySelectorAll('#evalGrid .evalCard').length,
      json: (document.querySelector('#evalJSON') || {}).textContent || ''
    }));
    out.evalset = { base: { cards: base.cards, cats: base.cats, stats: base.stats, p0: base.p0, jsonLen: base.json.length }, security, searched: searched.n };
    out.evalOk = base.cards === 30 && base.cats === 7 && base.stats === 4 && base.p0 === 14
      && base.json.length > 1000 && security === 5 && searched.n > 0 && searched.n < 30
      && /EV-011/.test(searched.json);
    allErrs.push(...errs);
    await c.close();
  }

  // ---------- 23. 决策报告：空态 → 选组合后生成五段报告 ----------
  {
    const { c, p, errs } = await fresh(browser, '#report');
    const empty = await p.evaluate(() => ({
      empty: !!document.querySelector('#reportBody .reportEmpty'),
      ctas: document.querySelectorAll('#reportBody .gchips a').length
    }));
    await p.evaluate(() => {
      localStorage.setItem('ats_stack', JSON.stringify(['dsh']));
      localStorage.setItem('ats_picked', JSON.stringify(['volc']));
    });
    await p.reload({ waitUntil: 'load' });
    await p.waitForTimeout(500);
    const full = await p.evaluate(() => ({
      sheet: !!document.querySelector('#reportBody .reportSheet'),
      secs: document.querySelectorAll('#reportBody .rpSec').length,
      tasks: document.querySelectorAll('#reportBody .rpTasks li').length,
      checks: document.querySelectorAll('#reportBody .rpCheck li').length,
      print: !!document.querySelector('#rpPrint'),
      copy: !!document.querySelector('#rpCopy'),
      total: (document.querySelector('#reportBody .rpBig') || {}).textContent || '',
      risk: document.querySelectorAll('#reportBody .rpRisk').length
    }));
    out.report = { empty, full };
    out.reportOk = empty.empty && empty.ctas >= 2 && full.sheet && full.secs === 5
      && full.tasks >= 5 && full.checks === 4 && full.print && full.copy
      && /¥40/.test(full.total) && full.risk >= 3;
    allErrs.push(...errs);
    await c.close();
  }

  out.errs = allErrs;
  out.pass = out.viewsOk && out.themeOk && out.overflowOk
    && out.drawer.onOpen.open && out.drawer.afterEsc.open === false
    && out.drawer.tabHitsWhenClosed === 0
    && out.skipFocus.cls === 'skip'
    && out.printOk
    && out.flowOk && out.mobileNavOk && out.notFoundOk && out.consoleOk && out.diagOk
    && out.planOk && out.adoptOk
    && out.newsOk && out.impactOk && out.rolesOk && out.freeOk && out.plans2Ok && out.invOk
    && out.healthOk && out.evalOk && out.reportOk
    && allErrs.length === 0;

  console.log(JSON.stringify(out, null, 2));
  await browser.close();
  process.exitCode = out.pass ? 0 : 1;
})();
