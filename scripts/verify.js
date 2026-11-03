const { launch } = require('./browser');
const path = require('path');
const BASE = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
// 42 个视图 = 24 个功能页 + home/map/all + 7 个站务页 + error + 6 个模块页 + 404
const VIEWS = ['home','overview','report','matrix','tools','capabilities','plans','promos','free','bundles','persona','aitest','events','news','impact','roles','evalset','versus','roadmap','stack','plan','opinion','changelog','sources','health','map','all','search','mine','feedback','about','help','privacy','contact','error','mod-diagnose','mod-grow','mod-shift','mod-toolkit','mod-choose','mod-data','404'];
// 站务页：不属于任何模块，面包屑只到「首页 › 页名」
const SITE_PAGES = ['search','mine','feedback','about','help','privacy','contact'];

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
    await p.click('#v-mod-diagnose .fgrid .fcard');
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
    // 6 个模块 = 6 张模块卡；首页多一张「全部功能」CTA 所以是 7；地图多一张「不确定从哪开始」所以是 7 卡 / 6 个模块链接
    out.flowOk = home.on && home.ctas === 2 && home.mods === 7
      && step1 === '#persona' && mapCards.total === 7 && mapCards.modLinks === 6
      && modHash === '#mod-diagnose' && feat.hash === '#overview'
      && feat.subnav && feat.crumbs >= 4 && feat.guide && more === '#all';
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
    await p.click('#mnavMods .mmod:nth-child(1) summary');
    await p.waitForTimeout(200);
    await p.click('#mnavMods .mmod:nth-child(1) .mmodLinks a');
    await p.waitForTimeout(300);
    const after = await p.evaluate(() => ({ hash: location.hash, closed: document.querySelector('#mnav').hidden }));
    out.mobileNav = { burgerVisible, opened, mods, ...after };
    out.mobileNavOk = burgerVisible && opened && mods === 6 && after.closed && after.hash === '#overview';
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
    // 24 个功能页 + 7 个站务页：死路上也得能看见全部岔口
    out.notFoundOk = nf.on && nf.links === 31 && nf.title.indexOf('页面不存在') >= 0 && t2.indexOf('工具库') >= 0;
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
      && afterQ > 0 && afterQ < 24 && afterMod.n === 6 && afterMod.on === 'diagnose'
      && jump === '#overview';
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

  // ---------- 24. 对外可发现性 + 纠错闭环（v2.2.1） ----------
  {
    const fs = require('fs');
    const { c, p, errs } = await fresh(browser);
    const head = await p.evaluate(() => ({
      canonical: (document.querySelector('link[rel="canonical"]') || {}).href || '',
      ogImage: (document.querySelector('meta[property="og:image"]') || {}).content || '',
      ogUrl: (document.querySelector('meta[property="og:url"]') || {}).content || '',
      twitter: (document.querySelector('meta[name="twitter:card"]') || {}).content || '',
      ld: (() => {
        const s = document.querySelector('script[type="application/ld+json"]');
        if (!s) return null;
        try { const j = JSON.parse(s.textContent); return j['@graph'].map(x => x['@type']); } catch (e) { return 'parse-fail'; }
      })(),
      // href 会把相对路径解析成绝对 URL，本地跑就是 file:///…——只留末尾的文件名，
      // 断言只关心它指向 feed.xml，没必要把本机路径写进产物
      feed: ((document.querySelector('link[rel="alternate"][type="application/atom+xml"]') || {}).href || '').split('/').pop(),
      site: window.__SITE__ || null
    }));

    const home = await p.evaluate(() => {
      const el = document.querySelector('#homeChg');
      return { hidden: el.hidden, rows: el.querySelectorAll('.hcR').length };
    });

    await p.evaluate(() => { location.hash = '#changelog'; });
    await p.waitForTimeout(300);
    const ch = await p.evaluate(() => ({
      rows: document.querySelectorAll('#chFeed .chRow').length,
      sum: (document.querySelector('#chSum') || {}).textContent || '',
      more: !document.querySelector('#chMore').hidden
    }));
    await p.click('#chChips button[data-ch="price"]');
    await p.waitForTimeout(200);
    const priceRows = await p.evaluate(() => ({
      n: document.querySelectorAll('#chFeed .chRow').length,
      fix: document.querySelectorAll('#chFeed [data-fix]').length
    }));

    // 纠错按钮必须真的拼出正确的 issue 表单地址（拦掉 window.open 看入参）
    const opened = await p.evaluate(() => {
      window.__opened = [];
      window.open = u => { window.__opened.push(u); return null; };
      const b = document.querySelector('#chFeed [data-fix]');
      if (b) b.click();
      return window.__opened;
    });

    const links = await p.evaluate(() => ({
      footer: document.querySelectorAll('#sfLinks a, #sfLinks button').length
    }));
    await p.evaluate(() => { location.hash = '#health'; });
    await p.waitForTimeout(300);
    const fixBox = await p.evaluate(() => document.querySelectorAll('#healthFix a, #healthFix button').length);

    // 时间序列导出：文件存在、行数与套餐数对得上
    const histCsv = path.resolve(__dirname, '..', 'exports', 'plans-history.csv');
    const histLines = fs.existsSync(histCsv)
      ? fs.readFileSync(histCsv, 'utf8').trim().split('\n').length - 1
      : -1;
    // 期望行数从数据现算，别写死：加一档套餐就要回来改常量，迟早忘。
    const plansData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'data', 'plans.json'), 'utf8'));
    const expectHist = plansData.reduce((n, x) => n + (x.history || [])
      .filter(e => e && e.date && typeof e.price === 'number').length, 0);

    out.site = { head, home, ch, priceRows, opened, links, fixBox, histLines };
    out.siteOk = /ai-test-stack\/$|localhost/.test(head.canonical)
      && /og\.png$/.test(head.ogImage)
      && head.ogUrl === head.canonical
      && head.twitter === 'summary_large_image'
      && Array.isArray(head.ld) && head.ld.length === 3
      && /feed\.xml$/.test(head.feed)
      && head.site && /issues\/new$/.test(head.site.issue || '')
      && home.hidden === false && home.rows === 3
      && ch.rows === 8 && /价格变动/.test(ch.sum) && /本站改动/.test(ch.sum) && ch.more
      && priceRows.n > 0 && priceRows.fix === priceRows.n
      && opened.length === 1 && /data-correction\.yml/.test(opened[0]) && /%E4%BB%B7%E6%A0%BC%E4%B8%8D%E5%AF%B9/.test(opened[0])
      && links.footer === 3 && fixBox === 3
      && histLines === expectHist;
    allErrs.push(...errs);
    await c.close();
  }

  // ---------- 25. 站务层：7 个站务页 + 配置驱动导航 + 旧地址重定向 ----------
  {
    const { c, p, errs } = await fresh(browser);
    const crumbs = {};
    const blocks = {};
    for (const v of SITE_PAGES) {
      await p.evaluate(v => { location.hash = '#' + v; }, v);
      await p.waitForTimeout(200);
      // 站务页不属于任何模块，但仍然必须有面包屑与返回路径
      crumbs[v] = await p.evaluate(() => {
        const sub = document.querySelector('#subnav');
        return { shown: !sub.hidden, items: sub.querySelectorAll('.crumbs a, .crumbs b').length, back: sub.querySelectorAll('.sibnav a').length };
      });
      blocks[v] = await p.evaluate(() => document.querySelectorAll('.view.on .panel, .view.on .mcard2, .view.on .fbk').length);
    }
    // 模块 7 → 6 合并后，旧地址必须重定向，而不是掉进 404
    await p.evaluate(() => { location.hash = '#mod-start'; });
    await p.waitForTimeout(300);
    const redirect = await p.evaluate(() => ({ hash: location.hash, on: (document.querySelector('.view.on') || {}).id || '' }));
    // 导航配置驱动：顶栏 4 个链接 + 2 个下拉；页脚 4 组；社区预留位 3 处
    const nav = await p.evaluate(() => ({
      top: document.querySelectorAll('#tnav > a').length,
      groups: document.querySelectorAll('#tnav .tdd').length,
      mobilePrim: document.querySelectorAll('#mnavPrim a').length,
      footGroups: document.querySelectorAll('#sfNav .sfgrp').length,
      footLinks: document.querySelectorAll('#sfNav a').length,
      reserved: document.querySelectorAll('.ddSoon').length,
      reachable: ['about', 'help', 'privacy', 'contact', 'feedback', 'search', 'mine']
        .every(v => document.querySelector('#sfNav a[href="#' + v + '"], #tnav a[href="#' + v + '"]'))
    }));
    out.sitePages = { crumbs, blocks, redirect, nav };
    out.sitePagesOk = Object.values(crumbs).every(x => x.shown && x.items >= 2 && x.back >= 3)
      && Object.values(blocks).every(n => n >= 1)
      && redirect.hash === '#mod-diagnose' && redirect.on === 'v-mod-diagnose'
      && nav.top === 4 && nav.groups === 2 && nav.mobilePrim >= 8
      && nav.footGroups === 4 && nav.footLinks >= 25 && nav.reserved === 3 && nav.reachable;
    allErrs.push(...errs);
    await c.close();
  }

  // ---------- 26. 全站搜索：命中分组 / 分类筛选 / 工具行直接开抽屉 ----------
  {
    const { c, p, errs } = await fresh(browser, '#search');
    await p.fill('#siteQ', '诊断');
    await p.waitForTimeout(400);
    const hit = await p.evaluate(() => ({
      groups: document.querySelectorAll('#siteQBody .sresGrp').length,
      rows: document.querySelectorAll('#siteQBody .sresRow').length,
      meta: (document.querySelector('#siteQMeta') || {}).textContent || ''
    }));
    await p.fill('#siteQ', '');
    await p.waitForTimeout(300);
    await p.click('#siteQCats [data-sq="tool"]');
    await p.waitForTimeout(300);
    const cat = await p.evaluate(() => ({
      rows: document.querySelectorAll('#siteQBody .sresRow').length,
      btns: document.querySelectorAll('#siteQBody button.sresRow').length,
      groups: document.querySelectorAll('#siteQBody .sresGrp').length,
      // 无查询词时每组只展示 5 条，剩下的靠「还有 N 条」展开——29 款工具必然有多余
      more: document.querySelectorAll('#siteQBody [data-sq-more]').length
    }));
    // 工具行是按钮：点了直接开抽屉，不跳页
    await p.click('#siteQBody button.sresRow');
    await p.waitForTimeout(450);
    const drawer = await p.evaluate(() => ({
      open: document.querySelector('#drawer').classList.contains('on'),
      name: (document.querySelector('#dbody .dn') || {}).textContent || ''
    }));
    // 搜不到时要有出路
    await p.keyboard.press('Escape');
    await p.click('#siteQCats [data-sq="all"]');
    await p.fill('#siteQ', 'zzz-no-such-thing');
    await p.waitForTimeout(400);
    const empty = await p.evaluate(() => ({
      n: document.querySelectorAll('#siteQBody .sresRow').length,
      text: (document.querySelector('#siteQBody .empty') || {}).textContent || ''
    }));
    out.search = { hit, cat, drawer, empty };
    out.searchOk = hit.groups >= 1 && hit.rows > 0 && /命中/.test(hit.meta)
      && cat.rows === 5 && cat.btns === cat.rows && cat.groups === 1 && cat.more === 1
      && drawer.open && drawer.name.length > 0
      && empty.n === 0 && empty.text.length > 0;
    allErrs.push(...errs);
    await c.close();
  }

  // ---------- 27. 个人中心：收藏 / 浏览历史 / 导出 / 二次确认清空 ----------
  {
    const { c, p, errs } = await fresh(browser, '#tools');
    // 点收藏不能顺带把工具抽屉打开（捕获阶段拦截的那条逻辑）
    await p.click('#tgrid .tcard .favb');
    await p.waitForTimeout(350);
    const fav = await p.evaluate(() => ({
      pressed: document.querySelector('#tgrid .tcard .favb').getAttribute('aria-pressed'),
      stored: JSON.parse(localStorage.getItem('ats_fav') || '[]').length,
      drawer: document.querySelector('#drawer').classList.contains('on')
    }));
    await p.evaluate(() => { location.hash = '#mine'; });
    await p.waitForTimeout(400);
    const mine = await p.evaluate(() => ({
      cards: document.querySelectorAll('#mineGrid .mcard2').length,
      favRows: document.querySelectorAll('#mineGrid .mcard2:first-child .mrow').length,
      recRows: document.querySelectorAll('#mineGrid .mrec').length,
      store: document.querySelectorAll('#mineStore .kv').length,
      acts: document.querySelectorAll('#mineActions a, #mineActions button').length,
      meta: (document.querySelector('#mineMeta') || {}).textContent || ''
    }));
    // 清空必须走二次确认：先确认「取消」不删，再确认会删
    await p.evaluate(() => { window.__asked = 0; window.confirm = () => { window.__asked++; return false; }; });
    await p.click('#mineClear');
    await p.waitForTimeout(250);
    const afterCancel = await p.evaluate(() => ({ asked: window.__asked, stored: JSON.parse(localStorage.getItem('ats_fav') || '[]').length }));
    await p.evaluate(() => { window.confirm = () => true; });
    await p.click('#mineClear');
    await p.waitForTimeout(350);
    const cleared = await p.evaluate(() => ({
      fav: JSON.parse(localStorage.getItem('ats_fav') || '[]').length,
      recent: JSON.parse(localStorage.getItem('ats_recent') || '[]').length,
      rows: document.querySelectorAll('#mineGrid .mrow').length
    }));
    out.mine = { fav, mine, afterCancel, cleared };
    out.mineOk = fav.pressed === 'true' && fav.stored === 1 && fav.drawer === false
      && mine.cards === 4 && mine.favRows >= 1 && mine.recRows >= 2 && mine.store === 9 && mine.acts === 3
      && /收藏 1 项/.test(mine.meta)
      && afterCancel.asked === 1 && afterCancel.stored === 1
      && cleared.fav === 0 && cleared.recent === 0;
    allErrs.push(...errs);
    await c.close();
  }

  // ---------- 28. 反馈闭环 + 渲染出错兜底 ----------
  {
    const { c, p, errs } = await fresh(browser, '#feedback');
    const kinds = await p.evaluate(() => document.querySelectorAll('#fbKinds .fbk').length);
    // 切到「数据纠错」：模板与 issue 模板都要跟着换
    await p.click('#fbKinds [data-fb="data"]');
    await p.waitForTimeout(250);
    await p.fill('#fbWhere', '套餐对比 · GLM Coding Lite');
    await p.fill('#fbText', '官网写的是 ¥138，页面是 ¥128。');
    await p.waitForTimeout(250);
    const dataForm = await p.evaluate(() => ({
      hint: (document.querySelector('#fbHint') || {}).textContent || '',
      note: (document.querySelector('#fbNote') || {}).textContent || '',
      prev: (document.querySelector('#fbPreview') || {}).textContent || ''
    }));
    const opened = await p.evaluate(() => {
      window.__opened = [];
      window.open = u => { window.__opened.push(u); return null; };
      document.querySelector('#fbOpen').click();
      return window.__opened;
    });
    // 从功能页底部「这一页有问题」跳过来：类型应为报错，且页名被带进「位置」
    // （先把输入框清空——不清空的话会保留用户已填的内容，那是刻意的行为）
    await p.evaluate(() => { location.hash = '#plans'; });
    await p.waitForTimeout(300);
    await p.evaluate(() => { const w = document.querySelector('#fbWhere'); if (w) w.value = ''; });
    await p.click('.pguide [data-fb-page]');
    await p.waitForTimeout(400);
    const carried = await p.evaluate(() => ({
      on: (document.querySelector('.view.on') || {}).id || '',
      kind: (document.querySelector('#fbKinds .fbk.on') || {}).dataset ? document.querySelector('#fbKinds .fbk.on').dataset.fb : '',
      where: (document.querySelector('#fbWhere') || {}).value || ''
    }));
    /* 渲染兜底：往数据里塞一条坏记录（`window.__DATA__` 和渲染函数引用的是同一个数组），
       让 #overview 的渲染真的抛一个 TypeError，验证路由接住它并切到 #error。
       这比调一个测试专用的假接口更接近真实故障。 */
    await p.evaluate(() => {
      window.__DATA__.tools.push(null);
      location.hash = '#overview';
    });
    await p.waitForTimeout(500);
    const errView = await p.evaluate(() => ({
      on: (document.querySelector('.view.on') || {}).id || '',
      links: document.querySelectorAll('#errLinks a').length,
      title: document.title,
      // 只留堆栈第一行：完整堆栈里每帧都带本机 file:// 路径，记进产物没有价值
      trace: (((document.querySelector('#errTrace') || {}).textContent || '').split('\n')[0] || ''),
      msg: ((document.querySelector('#errMsg') || {}).textContent || '')
    }));
    out.feedback = { kinds, dataForm, opened, carried, errView };
    out.feedbackOk = kinds === 4
      && /价格类|四样|来源/.test(dataForm.hint)
      && /data-correction\.yml/.test(dataForm.note)
      && /GLM Coding Lite/.test(dataForm.prev) && /¥138/.test(dataForm.prev)
      && opened.length === 1 && /data-correction\.yml/.test(opened[0])
      && carried.on === 'v-feedback' && carried.kind === 'bug' && carried.where === '套餐对比'
      && errView.on === 'v-error' && errView.links === 31
      && /出错/.test(errView.title) && /TypeError|cannot read/i.test(errView.trace)
      && /渲染时抛了一个异常/.test(errView.msg);
    allErrs.push(...errs);
    await c.close();
  }

  // ---------- 29. v9 前端质量地板：溢出 / 字号 / 排序 / 选中态 / 折叠 ----------
  {
    const { c, p, errs } = await fresh(browser);

    /* 29.1 横向溢出。v2.3 的第 6 组只在一个动画相位上取样（drift 是 22s 往复 +
       scale 1.06），所以它放过了 27–40px 的真实溢出。这里取三个相位，
       并且额外检查光斑结构上不许超出 hero 的盒子。 */
    const ov = {};
    for (const theme of ['dark', 'light']) {
      for (const [w, h] of [[1440, 900], [820, 1000], [390, 844]]) {
        await p.setViewportSize({ width: w, height: h });
        await p.evaluate((t) => {
          document.documentElement.dataset.theme = t;
          location.hash = '#home';
        }, theme);
        let ok = true;
        for (let k = 0; k < 3; k++) {
          await p.waitForTimeout(700);
          const s = await p.evaluate(() => {
            const g = document.querySelector('.hglow'), hb = document.querySelector('.hero');
            /* 光斑本身允许超出 hero 盒子（drift 会平移 + 放大它），关键是 hero 必须把它裁掉。
               所以结构断言是「hero 有横向裁剪」，行为断言是「文档不横向溢出」。 */
            const hx = g && hb ? getComputedStyle(hb).overflowX : 'clip';
            return {
              fits: document.documentElement.scrollWidth <= window.innerWidth + 1,
              clipped: hx === 'clip' || hx === 'hidden',
              docW: document.documentElement.scrollWidth,
              vw: window.innerWidth
            };
          });
          if (!s.fits || !s.clipped) { ok = false; ov[theme + '@' + w + '_fail'] = s; }
        }
        ov[theme + '@' + w] = ok;
      }
    }

    // 29.2 字号地板：任何一处可见文字都不许低于 11px
    await p.setViewportSize({ width: 1440, height: 900 });
    const floor = await p.evaluate(() => {
      let bad = 0, min = 99, total = 0;
      const sample = [];
      [...document.querySelectorAll('.view')].forEach(v => {
        v.querySelectorAll('*').forEach(el => {
          const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
          if (!own) return;
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') return;
          const px = parseFloat(cs.fontSize);
          total++;
          if (px < min) min = px;
          if (px < 11) {
            bad++;
            if (sample.length < 6) sample.push(v.id + ':' + ((typeof el.className === 'string' && el.className.trim()) ? el.className.trim().split(/\s+/)[0] : el.tagName) + '@' + px);
          }
        });
      });
      return { bad, min, total, sample };
    });

    // 29.3 套餐表：吸顶表头 + 点表头真的改顺序（按数据里的 CNY 价比，不按显示文本）
    await p.evaluate(() => { document.documentElement.dataset.theme = 'dark'; location.hash = '#plans'; });
    await p.waitForTimeout(500);
    const priceSeq = () => p.evaluate(() => [...document.querySelectorAll('#planBody tr')].map(tr => {
      const id = (tr.querySelector('[data-pick]') || {}).dataset ? tr.querySelector('[data-pick]').dataset.pick : '';
      const pl = window.__DATA__.plans.find(x => x.id === id) || {};
      return typeof pl.price === 'number' ? pl.price : NaN;
    }));
    const sticky = await p.evaluate(() => getComputedStyle(document.querySelector('#planTable thead th')).position);
    const before = await priceSeq();
    await p.click('#planTable th[data-sort="price"] button');
    await p.waitForTimeout(400);
    const ascAria = await p.evaluate(() => document.querySelector('#planTable th[data-sort="price"]').getAttribute('aria-sort'));
    const asc = await priceSeq();
    await p.click('#planTable th[data-sort="price"] button');
    await p.waitForTimeout(400);
    const descAria = await p.evaluate(() => document.querySelector('#planTable th[data-sort="price"]').getAttribute('aria-sort'));
    const desc = await priceSeq();
    const monotone = (arr, dir) => arr.length > 1 && arr.every((v, i) => i === 0 || (dir === 'asc' ? arr[i - 1] <= v : arr[i - 1] >= v));
    /* 排序不许污染结论：冠军卡永远按综合分，不跟着价格顺序跑 */
    const verdictKept = await p.evaluate(() => {
      const v = document.querySelector('#pVerdict .vn');
      return v ? v.textContent.trim() : '';
    });

    // 29.4 新鲜度条 + 阶梯默认折叠、可展开
    const freshBar = await p.evaluate(() => {
      const f = document.querySelector('#pFresh');
      return { txt: f ? f.textContent : '', link: !!document.querySelector('#pFresh a[href="#health"]') };
    });
    const ladderClosed = await p.evaluate(() => ({
      closed: document.querySelector('#pLadderPanel').classList.contains('is-closed'),
      aria: document.querySelector('#pLadderToggle').getAttribute('aria-expanded'),
      hidden: document.querySelector('#pLadder').offsetParent === null
    }));
    await p.click('#pLadderToggle');
    await p.waitForTimeout(350);
    const ladderOpen = await p.evaluate(() => ({
      closed: document.querySelector('#pLadderPanel').classList.contains('is-closed'),
      aria: document.querySelector('#pLadderToggle').getAttribute('aria-expanded'),
      rows: document.querySelectorAll('#pLadder .ladderRow').length,
      visible: document.querySelector('#pLadder').offsetParent !== null
    }));

    // 29.5 选中态必须看得出来：搜索页的分类 chip 以前压根没有 .on 样式
    await p.evaluate(() => { location.hash = '#search'; });
    await p.waitForTimeout(400);
    const chips = await p.evaluate(() => {
      const on = document.querySelector('#siteQCats .chip.on');
      const off = [...document.querySelectorAll('#siteQCats .chip')].find(c => !c.classList.contains('on'));
      if (!on || !off) return { found: false };
      const a = getComputedStyle(on), b = getComputedStyle(off);
      return { found: true, diff: a.backgroundColor !== b.backgroundColor || a.color !== b.color, onBg: a.backgroundColor, offBg: b.backgroundColor };
    });

    // 29.6 浅色主题不许有透明渐变大标题（对比度由 a11y 审，这里只锁实现方式）
    const head = await p.evaluate(() => {
      document.documentElement.dataset.theme = 'light';
      const em = document.querySelector('.hero h1 em');
      const cs = em ? getComputedStyle(em) : null;
      return cs ? { fill: cs.webkitTextFillColor, img: cs.backgroundImage !== 'none' } : { fill: '', img: false };
    });

    // 29.7 功能地图的计数必须来自数据，不许写死
    const lede = await p.evaluate(() => ({
      txt: (document.querySelector('#mapLede') || {}).textContent || '',
      // 以「屏幕上真的画出来几个模块卡」为准，而不是猜 __DATA__ 的形状
      mods: document.querySelectorAll('#mapBody .mcard:not(.maccent)').length
    }));

    out.uiFloor = { ov, floor, table: { sticky, before, asc, desc, ascAria, descAria, verdictKept }, freshBar, ladderClosed, ladderOpen, chips, head, lede };
    out.uiFloorOk = Object.values(ov).every(Boolean)
      && floor.bad === 0 && floor.min >= 11
      && sticky === 'sticky' && ascAria === 'ascending' && descAria === 'descending'
      && monotone(asc, 'asc') && monotone(desc, 'desc') && String(asc) !== String(before)
      && /天内核过/.test(freshBar.txt) && freshBar.link
      && ladderClosed.closed && ladderClosed.aria === 'false' && ladderClosed.hidden
      && !ladderOpen.closed && ladderOpen.aria === 'true' && ladderOpen.visible && ladderOpen.rows > 0
      && chips.found && chips.diff
      && head.fill !== 'rgba(0, 0, 0, 0)' && !head.img
      && lede.mods >= 5 && lede.txt.indexOf(lede.mods + ' 个模块') === 0;
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
    && out.healthOk && out.evalOk && out.reportOk && out.siteOk
    && out.sitePagesOk && out.searchOk && out.mineOk && out.feedbackOk
    && out.uiFloorOk
    && allErrs.length === 0;

  console.log(JSON.stringify(out, null, 2));
  await browser.close();
  process.exitCode = out.pass ? 0 : 1;
})();
