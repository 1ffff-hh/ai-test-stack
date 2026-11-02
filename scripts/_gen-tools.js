#!/usr/bin/env node
/* 一次性数据作者脚本：把新增工具合并进 data/tools.json
   跑法：node scripts/_gen-tools.js
   说明：原有 11 款保留，只做必要修订；新增 17 款，来源见各条 link 与 verified。 */
'use strict';
const fs = require('fs');
const path = require('path');
const P = path.join(__dirname, '..', 'data', 'tools.json');
const tools = JSON.parse(fs.readFileSync(P, 'utf8'));
const byId = Object.fromEntries(tools.map(t => [t.id, t]));

const V = '2026-11-01';
const cap = (o) => Object.assign({
  req_analysis: 2, testcase_gen: 2, testcase_review: 2, api_auto: 2, ui_auto: 2, defect: 2,
  code_understand: 2, refactor: 2, cli: 2, ci: 2, scriptable: 2,
  mcp: 1, skills: 1, multiagent: 1, cron: 1, memory: 1,
  gui: 2, onboard: 3, model_switch: 1, ecosystem: 2
}, o);

const add = [
  /* ---------------- 国际 · 编程外壳 ---------------- */
  {
    id: 'cursor', name: 'Cursor', vendor: 'Anysphere / SpaceX', letter: 'CU',
    grad: 'linear-gradient(135deg,#8b8b8b,#2b2b2b)',
    kind: 'shell', region: 'global', alias: 'X Subscription',
    tagline: '最顺手的 AI 编辑器，但 2026 年两次换壳',
    tags: ['AI 原生 IDE', '多 Agent', '已被 SpaceX 收购'],
    what: 'AI 原生编辑器，Composer 负责多文件改写，Agent 面板能跑终端、看报错、开后台 agent。2026-08-14 被 SpaceX 收购，10-12 起新客改走 X 订阅，包含额度只覆盖 Grok 系模型，Claude / GPT / Gemini 要按 API 原价另算。',
    use: '测试侧用它写 Playwright 用例、批量改夹具、看懂陌生仓库；Bugbot 能对 PR 做缺陷预扫。适合已经习惯 IDE、不想开终端的人。',
    strengths: [
      '编辑器内闭环最完整：补全、改写、终端、后台 agent 在同一窗口',
      'Composer 2.5 在多文件改动上便宜且快，适合"改 30 个用例的选择器"这类活',
      'Bugbot 对 PR 做缺陷扫描，测试团队可以拿来当第二双眼睛'
    ],
    weaknesses: [
      '订阅形态一年两变：Pro/Pro+ 老价还在，新客走 X 订阅，采购口径容易对不上',
      '第三方模型按 API 原价计费，Claude / GPT 重度用户的实际账单远高于标价',
      '编辑器锁定强，JetBrains / Neovim 团队收益明显打折'
    ],
    fit: '愿意换编辑器、以日常编码为主、能接受"标价不含第三方模型"的团队。纯 CI 自动化不是它的强项。',
    models: 'Grok 4.7 / Composer 2.5 含在订阅额度内；Claude、GPT、Gemini 需 Premium 档以上并按 API 价另计',
    score: { onboard: 5, cn: 1, eco: 5, model: 4, cost: 2, auto: 4, test: 4, future: 4, compliance: 2 },
    monthlyCost: 58, scriptable: true, cnDirect: false, license: '闭源', pricing: '订阅',
    link: 'https://cursor.com/pricing', firstSeen: '2023-03',
    risk: '2026 年内两次改价改壳；第三方模型另计费；国内需境外网络与支付',
    capabilities: cap({ req_analysis: 3, testcase_gen: 4, testcase_review: 3, api_auto: 4, ui_auto: 4, defect: 4, code_understand: 5, refactor: 5, cli: 4, ci: 4, scriptable: 4, mcp: 3, skills: 2, multiagent: 3, memory: 4, gui: 5, onboard: 4, model_switch: 4, ecosystem: 5 }),
    provenance: 'official', provenanceNote: '价格取自 cursor.com/pricing 与 X 订阅公告（2026-10-31 复核）；收购信息见 2026-08-14 官方公告。'
  },
  {
    id: 'copilot', name: 'GitHub Copilot', vendor: 'GitHub', letter: 'GH',
    grad: 'linear-gradient(135deg,#6e7bff,#24292f)',
    kind: 'shell', region: 'global',
    tagline: '最便宜的入场券，也是最容易忽略隐私条款的一家',
    tags: ['IDE 全覆盖', 'AI Credits', '企业 IP 赔付'],
    what: '覆盖 VS Code / JetBrains / Neovim / Xcode 的补全与 agent。2026-06-01 起把"高级请求"改成 AI Credits（1 credit = $0.01，按 token 扣），补全在付费档不计量。',
    use: '测试团队最现实的用法：全员装、只把它当补全和轻量 agent；重活交给专门的 CLI。Copilot CLI 与 coding agent 能从 issue 直接开 PR。',
    strengths: [
      'Pro $10 给 $15 额度，Max $100 给 $200 额度——唯一把"钱换额度"写清楚的厂商',
      'IDE 覆盖最广，JetBrains / Xcode 团队不用换工具',
      'Business $19 带 IP 赔付与审计日志，是过采购最容易的一档'
    ],
    weaknesses: [
      '自 2026-04-24 起，Free / Pro / Pro+ 的输入输出默认用于训练，除非手动关；Business / Enterprise 不受影响',
      '重度 agent 循环下额度消耗快，1500 credits 大约只够 5–15 个重任务',
      '模型选择多但每档限制不同，容易买了 Pro 才发现用不了某个模型'
    ],
    fit: '预算敏感、以补全为主、需要企业合规票据的团队。要把"关训练开关"写进上线检查单。',
    models: 'Claude / GPT / Gemini / Grok 多模型可选，按档位开放',
    score: { onboard: 5, cn: 1, eco: 5, model: 4, cost: 4, auto: 3, test: 4, future: 4, compliance: 3 },
    monthlyCost: 73, scriptable: true, cnDirect: false, license: '闭源', pricing: '订阅',
    link: 'https://github.com/features/copilot/plans', firstSeen: '2021-06',
    risk: '个人档默认用你的代码训练（2026-04-24 起）；额度按 token 折算，重度使用会超额',
    capabilities: cap({ req_analysis: 3, testcase_gen: 3, testcase_review: 3, api_auto: 3, ui_auto: 3, defect: 3, code_understand: 4, refactor: 4, cli: 4, ci: 4, scriptable: 4, mcp: 3, skills: 2, multiagent: 2, memory: 3, gui: 4, onboard: 5, model_switch: 4, ecosystem: 5 }),
    provenance: 'official', provenanceNote: '价格与 AI Credits 规则取自 GitHub 官方 plans 页与 2026-06-01 计费变更公告；训练条款见 2026-04-24 隐私更新。'
  },
  {
    id: 'muse', name: 'Muse Code', vendor: 'Meta', letter: 'MU',
    grad: 'linear-gradient(135deg,#5b8cff,#12306b)',
    kind: 'shell', region: 'global', alias: 'Muse',
    tagline: '$5 起步的 Claude Code 平替，代价是默认拿你的代码训练',
    tags: ['终端 Agent', '多 Agent 工作流', 'Contributor 折价'],
    what: 'Meta 的终端编程 agent，2026-08-05  beta、08-31 转正。多 agent 默认开启：worker 并行、reviewer 后台跑；每次工具调用、审批、改动都写进可回放的事件日志。',
    use: '适合把大任务拆给多个 subagent 并行（比如一次迁 5 个模块），事件日志对测试复现很友好。Windows 走 PowerShell，语音输入不可用。',
    strengths: [
      '订阅 $5 / $15 / $50 / $200 四档，入门价是同级最低',
      '每个 subagent 独立 git worktree + 可回放事件日志，多 agent 跑完还能查是谁改的',
      'API 有 Contributor 档：$0.10/$0.20 每百万 token，约为标准价 1/12'
    ],
    weaknesses: [
      '订阅默认 Contributor 模式：Meta 可用你的 prompt、代码、文件训练未来模型，要去设置里关',
      'Contributor 折价只对美国账号开放，且没有任何 SOC 2 / HIPAA / 数据驻留承诺',
      '只跑 Meta 自家模型；按量档没有消费上限，agent 跑飞了账单也飞'
    ],
    fit: '个人与小团队、能接受"用数据换低价"、不需要合规背书。企业客户先别碰 Contributor 档。',
    models: 'Muse Spark 1.3 / Muse Wonder；Muse Wonder Full 只在 Power 及以上档、且不能走 API',
    score: { onboard: 4, cn: 1, eco: 3, model: 4, cost: 5, auto: 5, test: 4, future: 4, compliance: 1 },
    monthlyCost: 36, scriptable: true, cnDirect: false, license: '闭源', pricing: '订阅',
    link: 'https://dev.meta.ai/products/muse-code', firstSeen: '2026-08',
    risk: '默认开启训练授权；Contributor 仅限美国账号；按量档无消费上限',
    capabilities: cap({ req_analysis: 3, testcase_gen: 4, testcase_review: 3, api_auto: 4, ui_auto: 4, defect: 4, code_understand: 5, refactor: 5, cli: 5, ci: 5, scriptable: 5, mcp: 3, skills: 3, multiagent: 5, cron: 3, memory: 4, gui: 1, onboard: 3, model_switch: 1, ecosystem: 2 }),
    provenance: 'official', provenanceNote: '订阅价与模型价取自 dev.meta.ai/products/muse-code（2026-10-31 复核）；训练默认值与 Contributor 地域限制见 Meta 定价文档与第三方评测。'
  },
  {
    id: 'grok', name: 'Grok Build', vendor: 'xAI', letter: 'GR',
    grad: 'linear-gradient(135deg,#d7dde8,#0b0d12)',
    kind: 'shell', region: 'global', alias: 'Grok Bot / X Subscription',
    tagline: '跟着 X 订阅卖，$8 就能用，但额度是共享池',
    tags: ['终端 Agent', 'X 订阅捆绑', 'Arena 模式'],
    what: 'xAI 官方终端 agent，2026-05-14 首发、只给 $300 档，05-25 下放到全部 SuperGrok。10-12 起新客统一走 X 订阅：Plus $8 / Premium $30 / Super $100 / Ultra $200。Grok Bot 是 Premium 档附带的个人 agent，不是编程工具，别买错。',
    use: 'Plan mode 先出计划再改代码，Arena 模式让多个模型对同一任务出方案、你挑一个。适合"不确定哪种改法对"的排障场景。',
    strengths: [
      '$8 起步，是主流终端 agent 里最低的门口',
      'Arena 模式独此一家：同一任务多模型竞标，适合高风险改动',
      '与 X / Grok 共用一个池，已经在付 X Premium 的人边际成本接近零'
    ],
    weaknesses: [
      '不单卖：没有 X 账号就没有 Grok Build',
      '官方只公布"4x / 15x / 50x"倍数，不公布具体请求数，容量无法预估',
      'Plus 档与聊天、语音、Imagine 共享额度，一次长会话会把别的也用掉'
    ],
    fit: '已经在用 X / Grok、想要一个便宜终端 agent 的个人。团队采购要按"共享池"做容量假设。',
    models: 'Grok 4.7（默认）；API 另有 grok-build-0.1（$1/$2 每百万 token）',
    score: { onboard: 4, cn: 1, eco: 3, model: 4, cost: 5, auto: 4, test: 3, future: 4, compliance: 2 },
    monthlyCost: 58, scriptable: true, cnDirect: false, license: '闭源', pricing: '订阅',
    link: 'https://x.ai/cli', firstSeen: '2026-05',
    risk: '额度是 X 订阅共享池；官方不公布绝对请求数；国内需境外网络与支付',
    capabilities: cap({ req_analysis: 3, testcase_gen: 4, testcase_review: 3, api_auto: 3, ui_auto: 3, defect: 4, code_understand: 4, refactor: 4, cli: 5, ci: 5, scriptable: 5, mcp: 3, skills: 3, multiagent: 3, memory: 3, gui: 1, onboard: 3, model_switch: 2, ecosystem: 3 }),
    provenance: 'official', provenanceNote: '档位与倍数取自 xAI / X 订阅页（2026-10-31 复核）；Grok Bot 归属见 X 订阅权益说明。'
  },
  {
    id: 'antigravity', name: 'Google Antigravity', vendor: 'Google', letter: 'AG',
    grad: 'linear-gradient(135deg,#4f8cff,#c7d6ff)',
    kind: 'shell', region: 'global', alias: 'Gemini CLI 继任者',
    tagline: '免费额度最狠，也最会在你依赖它时缩水',
    tags: ['多 Agent 并行', '每周配额', '免费档最能打'],
    what: 'Google 的 agent-first IDE + CLI，2025-11 公测，2026 I/O 升到 2.0。Agent Manager 能同时跑多个 agent，产出可复核的 Artifacts（计划、截图、浏览器录像）。个人档免费，配额按周刷新。',
    use: '测试侧最实用的是浏览器录像与 Artifacts：agent 跑完 UI 流程，你直接看录像而不是读日志。也适合并行验证多个修复方案。',
    strengths: [
      '个人档 $0，模型覆盖 Gemini 3.5 Flash / 3.1 Pro / Claude / gpt-oss，试错成本最低',
      'Artifacts 把"agent 做了什么"变成可审阅的证据，比纯文本日志适合测试留痕',
      'CLI 与 IDE 同一套 agent，能在本地和流水线复用'
    ],
    weaknesses: [
      '2026-06-18 Google 把 Gemini CLI 免费额度从约 1000 次/天砍到几十次，并把它并入 Antigravity CLI——免费档随时可能再缩',
      '周配额可能周三就见底，付费只能买 Google AI 订阅，不能单独买 IDE',
      'Ultra 档价格在 2026 年内多次变动（$99.99 / $199.99 / $249.99 都有报道），下单前必须看现价'
    ],
    fit: '预算为零、想先跑通多 agent 工作流的个人与小团队。要写进预算的团队别把免费档当容量。',
    models: 'Gemini 3.5 Flash / 3.1 Pro、Claude Sonnet / Opus、gpt-oss-120b（按档位）',
    score: { onboard: 4, cn: 1, eco: 4, model: 4, cost: 5, auto: 4, test: 4, future: 4, compliance: 2 },
    monthlyCost: 0, scriptable: true, cnDirect: false, license: '闭源', pricing: '免费+订阅',
    link: 'https://antigravity.google/', firstSeen: '2025-11',
    risk: '免费额度 2026-06 已被大幅削减；Ultra 价格多次变动；国内需境外网络',
    capabilities: cap({ req_analysis: 3, testcase_gen: 4, testcase_review: 3, api_auto: 4, ui_auto: 4, defect: 3, code_understand: 4, refactor: 4, cli: 4, ci: 4, scriptable: 4, mcp: 3, skills: 2, multiagent: 4, memory: 4, gui: 4, onboard: 4, model_switch: 4, ecosystem: 3 }),
    provenance: 'official', provenanceNote: '免费档与 AI Pro / Ultra 关系取自 Google Antigravity 官方页；2026-06-18 免费额度调整见官方开发者论坛与多家媒体。'
  },
  {
    id: 'devin', name: 'Devin Desktop', vendor: 'Cognition', letter: 'DV',
    grad: 'linear-gradient(135deg,#7de2c3,#0f3d33)',
    kind: 'shell', region: 'global', alias: '原 Windsurf',
    tagline: 'Windsurf 改名后的样子：本地 agent + 云端委派',
    tags: ['Agent 指挥台', '云 agent', '原 Windsurf'],
    what: 'Cognition 在 2026-06-02 把 Windsurf 改名 Devin Desktop，Cascade 由 Devin Local 接替。主界面是 Agent Command Center：本地与云端 agent 并排跑，Spaces 共享上下文。',
    use: '把"写用例—跑—修"拆给本地 agent，把"跑一晚上回归、第二天看结果"委派给云 agent。适合有大量稳定回归套件的团队。',
    strengths: [
      '本地 + 云端同一块看板，长任务不用守着终端',
      'Cognition 的 SWE 系列模型在仓库级任务上成熟，大仓上下文加载是强项',
      'Free 档有轻量配额，Pro $20 起，价格与主流对齐'
    ],
    weaknesses: [
      'JetBrains 插件进入维护模式，官方让转 ACP，非 VS Code 系团队体验断层',
      '云端 agent 按 ACU / 用量计费，跑长任务时账单不透明',
      '改名后文档与社区内容混杂，搜"Windsurf"会看到过期信息'
    ],
    fit: 'VS Code 系、有大量可委派的长任务、愿意为"不用守着"付溢价。',
    models: 'SWE-2 自研 + OpenAI / Claude / Gemini / xAI（按档位）',
    score: { onboard: 4, cn: 1, eco: 4, model: 4, cost: 3, auto: 4, test: 4, future: 4, compliance: 3 },
    monthlyCost: 145, scriptable: true, cnDirect: false, license: '闭源', pricing: '订阅',
    link: 'https://devin.ai/pricing', firstSeen: '2024-03',
    risk: '云端用量另计；JetBrains 支持退化；国内需境外网络与支付',
    capabilities: cap({ req_analysis: 3, testcase_gen: 4, testcase_review: 3, api_auto: 4, ui_auto: 4, defect: 4, code_understand: 5, refactor: 4, cli: 3, ci: 4, scriptable: 4, mcp: 3, skills: 2, multiagent: 4, cron: 3, memory: 4, gui: 4, onboard: 4, model_switch: 3, ecosystem: 4 }),
    provenance: 'official', provenanceNote: '改名与档位取自 Cognition / Devin 官方 FAQ 与定价页（2026-10-31 复核）。'
  },
  {
    id: 'kiro', name: 'Kiro', vendor: 'AWS', letter: 'KI',
    grad: 'linear-gradient(135deg,#ffb84d,#4a2a00)',
    kind: 'shell', region: 'global',
    tagline: '先写规格再写代码，最适合"要留证据"的团队',
    tags: ['规格驱动', 'Hooks', 'AWS 生态'],
    what: 'AWS 的 agentic IDE，2025-11 GA。它先把一句话需求展开成 requirements / design / tasks 三份文档，再动代码；hooks 能在保存文件等事件上触发 agent。',
    use: '测试团队最该学的是它的"先出规格"：把需求转成可评审的验收条件，再让 agent 写用例。产出的 spec 本身就是测试依据。',
    strengths: [
      '规格、设计、任务三段留痕，天然适配评审与审计',
      'Free 档每月 50 credits，能真正跑通流程再决定要不要买',
      'CLI 与 IDE 共享 steering 文件与 MCP 配置，规则只写一份'
    ],
    weaknesses: [
      'credit 消耗不直观，大任务一次能吃掉几百 credits；超额 $0.04/credit',
      '规格驱动对"改一行"的小活是负担，流程比别的工具重',
      '深度绑定 AWS 生态，非 AWS 团队收益打折'
    ],
    fit: '需要评审证据、流程规范、AWS 为主的团队；也适合作为"AI 产出可追溯"的示范工具。',
    models: 'Claude 系 + Qwen3 Coder Next / DeepSeek 等开放权重模型',
    score: { onboard: 3, cn: 1, eco: 3, model: 4, cost: 3, auto: 4, test: 4, future: 4, compliance: 4 },
    monthlyCost: 145, scriptable: true, cnDirect: false, license: '闭源', pricing: '订阅',
    link: 'https://kiro.dev/pricing/', firstSeen: '2025-07',
    risk: 'credits 超额 $0.04/个；流程偏重；国内需境外网络与支付',
    capabilities: cap({ req_analysis: 5, testcase_gen: 4, testcase_review: 4, api_auto: 3, ui_auto: 3, defect: 3, code_understand: 4, refactor: 4, cli: 4, ci: 4, scriptable: 4, mcp: 4, skills: 3, multiagent: 3, cron: 2, memory: 4, gui: 4, onboard: 3, model_switch: 3, ecosystem: 3 }),
    provenance: 'official', provenanceNote: '档位与 credits 规则取自 kiro.dev/pricing（2026-10-31 复核）。'
  },
  {
    id: 'opencode', name: 'OpenCode', vendor: 'Anomaly', letter: 'OC',
    grad: 'linear-gradient(135deg,#b8f36b,#1d2b0a)',
    kind: 'shell', region: 'global',
    tagline: '20 万星的 MIT 终端 agent，BYOK 的最优壳',
    tags: ['开源 MIT', '75+ 模型商', '可接 Copilot 账号'],
    what: 'MIT 协议的终端 / 桌面 / IDE agent，通过 Models.dev 接 75 家以上模型商，也能直接用 GitHub Copilot 或 ChatGPT Plus/Pro 账号登录。2026-10 时 GitHub 星数已过 20 万。',
    use: '测试团队想"一个壳接所有电"时最省事：今天用 DeepSeek，明天换 GLM，脚本不用改。CI 里也能跑。',
    strengths: [
      '真开源、可审计，能进有代码审计要求的环境',
      '一个壳接 75+ 模型商，换模型不改工作流',
      '能复用已有的 Copilot / ChatGPT 订阅，不重复付费'
    ],
    weaknesses: [
      '壳免费不代表便宜：账单完全取决于你接的模型',
      '多模型切换带来配置复杂度，团队要自己维护模型清单',
      '没有官方 SLA，企业支持靠自己'
    ],
    fit: '有 DevOps 能力、想自己掌控模型与成本的团队；也是"反锁定"的默认答案。',
    models: '任意 OpenAI 兼容 / Anthropic 兼容端点，含本地模型',
    score: { onboard: 2, cn: 4, eco: 4, model: 4, cost: 5, auto: 5, test: 4, future: 4, compliance: 4 },
    monthlyCost: 0, scriptable: true, cnDirect: true, license: 'MIT', pricing: '免费+自付模型',
    link: 'https://github.com/anomalyco/opencode', firstSeen: '2025-06',
    risk: '成本随模型波动；配置门槛高；无官方支持',
    capabilities: cap({ req_analysis: 3, testcase_gen: 4, testcase_review: 3, api_auto: 4, ui_auto: 4, defect: 4, code_understand: 4, refactor: 4, cli: 5, ci: 5, scriptable: 5, mcp: 4, skills: 3, multiagent: 3, cron: 3, memory: 3, gui: 3, onboard: 2, model_switch: 5, ecosystem: 4 }),
    provenance: 'official', provenanceNote: '协议与模型商数量取自仓库 README（2026-10 星数 20 万+，多来源交叉）。'
  },

  /* ---------------- 国内 · 编程外壳 ---------------- */
  {
    id: 'trae', name: 'Trae', vendor: '字节跳动', letter: 'TR',
    grad: 'linear-gradient(135deg,#6ee7ff,#0b2a4a)',
    kind: 'shell', region: 'cn',
    tagline: '国内最便宜的 AI IDE，但 ¥49 那档不能写代码',
    tags: ['AI IDE', '积分制', 'SOLO / Work 双模式'],
    what: '字节的 AI 原生 IDE，Work（原 SOLO）与 IDE 双模式。2026 年全面改积分制：订阅费买一池积分，调用内置模型按 token 扣；调用自定义模型不扣积分。',
    use: '测试侧用 IDE 模式写 Playwright / pytest；Work 模式适合从一句话生成一个可跑的验证脚本。想省钱的人可以自带 API Key 当免费外壳。',
    strengths: [
      '个人入门价最低，Pro ¥99 就能用全量高级模型',
      '自定义模型不扣积分——手里有 API Key 的话，它就是个免费 IDE 壳',
      '国内直连、人民币付款，中文提示理解好'
    ],
    weaknesses: [
      '¥49 的 Lite 档官方写明"仅 Trae Work"，不能在 IDE 里写代码；真正能编程的入门价是 ¥99',
      '积分是自家记账单位，同样任务在不同模型上扣除差好几倍，无法跨厂商比价',
      '2026-10 起签到积分设上限，额度用完后 ¥50 / 1000 积分续命'
    ],
    fit: '预算敏感的个人与中小团队；需要"自带 Key 白嫖壳"的人。企业采购要看积分条款。',
    models: '豆包、DeepSeek、Kimi、Qwen-Coder、GLM 等（国内版）；国际版另有 Claude / GPT',
    score: { onboard: 5, cn: 5, eco: 3, model: 4, cost: 4, auto: 2, test: 3, future: 4, compliance: 3 },
    monthlyCost: 99, scriptable: false, cnDirect: true, license: '闭源', pricing: '订阅',
    link: 'https://www.trae.cn/pricing', firstSeen: '2025-01',
    risk: 'Lite 档不含 IDE 编程；积分不可跨厂商比价；签到积分有上限',
    capabilities: cap({ req_analysis: 3, testcase_gen: 4, testcase_review: 3, api_auto: 3, ui_auto: 3, defect: 3, code_understand: 4, refactor: 4, cli: 1, ci: 2, scriptable: 2, mcp: 3, skills: 2, multiagent: 3, memory: 3, gui: 5, onboard: 5, model_switch: 3, ecosystem: 3 }),
    provenance: 'official', provenanceNote: '档位与积分规则取自 Trae 官方套餐表与 2026-10 社区实测；Lite 仅 Work 的限定见官方套餐说明。'
  },
  {
    id: 'comate', name: '文心快码 Comate', vendor: '百度', letter: 'BC',
    grad: 'linear-gradient(135deg,#7aa2ff,#101a3a)',
    kind: 'shell', region: 'cn',
    tagline: '个人档最能白嫖，额度表却有两套价',
    tags: ['个人免费', 'F2C 设计稿转代码', '私有化'],
    what: '百度的 AI 编程助手，插件 + 独立 IDE。个人标准版免费且补全不限次；专业版按积分计，官网写 ¥59、百度智能云文档写标准价 ¥70。企业版支持私有化与模型定制。',
    use: '测试侧常用它的单测生成、代码安全扫描、旧代码重构；F2C 能把 Figma 稿转成页面，前端联调时省事。',
    strengths: [
      '个人标准版免费、补全不限次，是四家里免费层最完整的',
      '专业版给 25000 积分，同价位账面额度最大（但积分不等于 token）',
      '企业私有化与信创适配成熟，国企 / 金融落地多'
    ],
    weaknesses: [
      '同一档有两套官方价（¥59 官网 / ¥70 智能云文档），做预算要按高标准算',
      '积分面值大不等于便宜，1 积分值多少 token 由各家自定',
      '额度用完切 Auto-Free 后限速 150k tokens/小时，7 月起已从"无限"收紧'
    ],
    fit: '学生、预算为零的个人、需要私有化的政企。别被"25000 积分"的面值迷惑。',
    models: '文心 ERNIE 系为主，部分档位可接第三方',
    score: { onboard: 5, cn: 5, eco: 3, model: 3, cost: 5, auto: 2, test: 3, future: 3, compliance: 4 },
    monthlyCost: 59, scriptable: false, cnDirect: true, license: '闭源', pricing: '免费+订阅',
    link: 'https://comate.baidu.com/', firstSeen: '2023-10',
    risk: '同档两套官方价；积分口径不透明；免费兜底已限速',
    capabilities: cap({ req_analysis: 3, testcase_gen: 4, testcase_review: 3, api_auto: 3, ui_auto: 3, defect: 3, code_understand: 3, refactor: 4, cli: 1, ci: 2, scriptable: 2, mcp: 2, skills: 2, multiagent: 2, memory: 2, gui: 5, onboard: 5, model_switch: 2, ecosystem: 2 }),
    provenance: 'official', provenanceNote: '价格分别取自官网与百度智能云文档（两套口径均保留）；限速见 2026-07 官方说明与社区实测。'
  },
  {
    id: 'codebuddy', name: 'CodeBuddy', vendor: '腾讯云', letter: 'CB',
    grad: 'linear-gradient(135deg,#4fd1c5,#04302c)',
    kind: 'shell', region: 'cn',
    tagline: '腾讯系的流程原生派，积分一半是活动送的',
    tags: ['CLI + IDE', '小程序友好', '积分制'],
    what: '腾讯云的 AI 编程工具，插件 / 独立 IDE / CLI 三形态，深度打通微信小程序与云开发。2026 年转积分制，标准版标 4000 积分，其中一半是活动赠送。',
    use: '测试侧做小程序自动化、云函数联调比较顺；Plan 模式可以先出改动计划再执行，适合让新人先看再做。',
    strengths: [
      '小程序 / 云开发 / TDesign 场景开箱即用，别家没有这个深度',
      'CLI 管道集成能力强，能进 CI',
      '企业版等保三级，SaaS ¥198/人月，专有云 ¥316/人月'
    ],
    weaknesses: [
      '标准版 4000 积分里一半是活动赠送，促销结束后给多少要看届时定价页',
      '¥99 / ¥199 / ¥999 三档跨度大，档位间能力差异不够透明',
      '国际版与国内版是两套价（$9.95 / $40），跨境团队容易买错'
    ],
    fit: '腾讯云 / 小程序技术栈、需要 CLI 与流程管控的团队。',
    models: '混元 + DeepSeek 等（国内版）；国际版可接 Claude / GPT',
    score: { onboard: 4, cn: 5, eco: 4, model: 3, cost: 3, auto: 3, test: 3, future: 4, compliance: 4 },
    monthlyCost: 99, scriptable: true, cnDirect: true, license: '闭源', pricing: '订阅',
    link: 'https://copilot.tencent.com/', firstSeen: '2024-09',
    risk: '积分含活动赠送；国内外两套价；档位能力差异不透明',
    capabilities: cap({ req_analysis: 3, testcase_gen: 4, testcase_review: 3, api_auto: 3, ui_auto: 3, defect: 3, code_understand: 4, refactor: 4, cli: 4, ci: 4, scriptable: 4, mcp: 3, skills: 2, multiagent: 3, memory: 3, gui: 4, onboard: 4, model_switch: 3, ecosystem: 3 }),
    provenance: 'official', provenanceNote: '档位与积分取自腾讯云 CodeBuddy 定价页；"一半为活动赠送"见 2026-10 社区实测。'
  },
  {
    id: 'codegeex', name: 'CodeGeeX', vendor: '智谱', letter: 'CG',
    grad: 'linear-gradient(135deg,#9d8cff,#211a4a)',
    kind: 'shell', region: 'cn',
    tagline: '开源起家，免费档全功能，适合离线与信创',
    tags: ['开源模型', '免费全功能', '本地部署'],
    what: '智谱的代码助手，插件形态，底层是自家开源代码模型。免费版功能完整，Pro ¥49；支持国产硬件与本地离线部署。',
    use: '测试侧做代码翻译、注释生成、单测补全；离线环境里能跑是它相对别家的硬优势。',
    strengths: [
      '免费档就能用全功能，不靠"限次"逼付费',
      '开源模型可本地部署，代码不出内网',
      '价格是国产里最低的一档（Pro ¥49）'
    ],
    weaknesses: [
      '模型能力与一线（Claude / GPT / GLM 旗舰）有代差，复杂重构会露怯',
      '插件形态，没有 CLI / 云 agent，进 CI 要自己包',
      '生态与文档更新慢，遇到新框架容易给出旧写法'
    ],
    fit: '内网 / 信创 / 教学场景，或只需要补全与单测的个人。',
    models: 'CodeGeeX 自研开源模型',
    score: { onboard: 5, cn: 5, eco: 2, model: 3, cost: 5, auto: 1, test: 2, future: 3, compliance: 5 },
    monthlyCost: 49, scriptable: false, cnDirect: true, license: '开源+订阅', pricing: '免费+订阅',
    link: 'https://codegeex.cn/', firstSeen: '2022-09',
    risk: '模型能力有代差；无 CLI / CI 能力',
    capabilities: cap({ req_analysis: 2, testcase_gen: 3, testcase_review: 2, api_auto: 2, ui_auto: 2, defect: 2, code_understand: 3, refactor: 3, cli: 1, ci: 1, scriptable: 1, mcp: 1, skills: 1, multiagent: 1, memory: 2, gui: 4, onboard: 5, model_switch: 1, ecosystem: 2 }),
    provenance: 'official', provenanceNote: '价格取自 CodeGeeX 官网；开源与本地部署见官方仓库说明。'
  },

  /* ---------------- 国际 · AI 测试平台 ---------------- */
  {
    id: 'testrigor', name: 'testRigor', vendor: 'testRigor', letter: 'tR',
    grad: 'linear-gradient(135deg,#ff8fb1,#3a0d1c)',
    kind: 'qa', region: 'global',
    tagline: '用大白话写端到端用例，维护成本最低的那一类',
    tags: ['自然语言用例', '自愈', '跨 Web/移动/桌面'],
    what: '用自然语言步骤驱动生成式执行，覆盖 Web、移动、API、桌面；Vision AI 能在找不到选择器时"看屏幕"找替代元素，也能测 LLM / 聊天机器人。',
    use: '业务同学也能写用例；回归套件维护量比 Selenium 系低。适合"用例多、前端常改、缺自动化工程师"的团队。',
    strengths: [
      '自然语言写用例，上手门槛是同类里最低的',
      '自愈 + 视觉兜底，UI 改版后的修复量明显少',
      '能直接测对话式 AI 功能，这是多数传统平台没有的'
    ],
    weaknesses: [
      '复杂场景下大白话不够精确，仍要写条件与断言',
      '价格不公开：免费档所有用例与结果公开；私有档第三方口径从 $300 到 $900/月不等',
      '小团队用起来偏贵，按用例量计费会随覆盖扩张'
    ],
    fit: '业务测试占比高、前端迭代快、想压低维护成本的团队。采购前必须拿到含税报价。',
    models: '内置生成式执行引擎，不对外暴露模型选择',
    score: { onboard: 5, cn: 2, eco: 3, model: 3, cost: 2, auto: 5, test: 5, future: 3, compliance: 3 },
    monthlyCost: 2175, scriptable: true, cnDirect: false, license: '闭源', pricing: '订阅',
    link: 'https://testrigor.com/pricing/', firstSeen: '2019-01',
    risk: '私有档价格不公开；免费档用例公开；国内访问与付款不便',
    capabilities: cap({ req_analysis: 2, testcase_gen: 5, testcase_review: 2, api_auto: 3, ui_auto: 5, defect: 3, code_understand: 1, refactor: 1, cli: 3, ci: 4, scriptable: 3, mcp: 1, skills: 2, multiagent: 2, cron: 2, memory: 2, gui: 5, onboard: 5, model_switch: 1, ecosystem: 3 }),
    provenance: 'mixed', provenanceNote: '官方只公开免费档与"定制报价"；$300/$900 为第三方 2026-06/10 报道区间，页面已标注为区间而非标价。'
  },
  {
    id: 'mabl', name: 'mabl', vendor: 'mabl', letter: 'MB',
    grad: 'linear-gradient(135deg,#66d9c0,#062e28)',
    kind: 'qa', region: 'global',
    tagline: '一个平台覆盖 Web/API/移动/无障碍，默认带自愈',
    tags: ['低代码', '自愈', 'Agentic Tester'],
    what: 'AI 原生的测试平台：浏览器里录制流程，AI 自动修复 UI 变更、加智能等待、做视觉回归，2026 年加了 Agentic Tester 负责探索与分诊。集成 GitHub / GitLab / Jenkins / Azure DevOps。',
    use: '适合工程主导、想要一套统一 E2E 覆盖的团队；把"选择器维护"这件最耗人的事交给平台。',
    strengths: [
      'Web / API / 移动 / 无障碍一个平台覆盖，减少工具拼接',
      '自愈范围广，UI 改动后的红灯多半能自己修',
      'CI 集成成熟，测试结果能直接卡流水线'
    ],
    weaknesses: [
      '不公开报价，第三方估算 $450–500/月起，企业档更高',
      '基于 DOM 的识别在 canvas / shadow DOM 上会失效',
      '成本随测试量增长，套件越大越难压价'
    ],
    fit: '有稳定产品、需要统一 E2E 与无障碍覆盖、不想自建平台的中大型团队。',
    models: '内置，不暴露模型选择',
    score: { onboard: 4, cn: 2, eco: 4, model: 3, cost: 2, auto: 5, test: 5, future: 4, compliance: 4 },
    monthlyCost: 3400, scriptable: true, cnDirect: false, license: '闭源', pricing: '订阅',
    link: 'https://www.mabl.com/pricing', firstSeen: '2018-01',
    risk: '报价制，预算难预估；canvas / shadow DOM 支持弱；国内访问慢',
    capabilities: cap({ req_analysis: 2, testcase_gen: 5, testcase_review: 3, api_auto: 4, ui_auto: 5, defect: 4, code_understand: 1, refactor: 1, cli: 3, ci: 5, scriptable: 3, mcp: 2, skills: 2, multiagent: 3, cron: 2, memory: 3, gui: 5, onboard: 4, model_switch: 1, ecosystem: 4 }),
    provenance: 'mixed', provenanceNote: '官方为定制报价；$450–500 为第三方 2026 估算区间，页面标注为估算。'
  },
  {
    id: 'qawolf', name: 'QA Wolf', vendor: 'QA Wolf', letter: 'QW',
    grad: 'linear-gradient(135deg,#ffd166,#3a2a00)',
    kind: 'qa', region: 'global',
    tagline: '把测试外包成服务：80% 覆盖、零 flake、人复核',
    tags: ['托管服务', 'Playwright 原生', '按分钟计费'],
    what: 'Coverage-as-a-Service：厂商帮你建、跑、修套件，承诺 80%+ 覆盖与零 flaky，缺陷由人类 QA 复核后交付。自建平台按 1¢/AI credit + 15¢/runner minute 计量，不收席位费。',
    use: '有上线死线、缺 QA 人手的团队可以"买时间"；套件是标准 Playwright 代码，可导出，锁定度低。',
    strengths: [
      '交付物是标准 Playwright 代码，能带走，锁定风险低',
      '自建平台公开计量价（credit + runner minute），比报价制透明',
      '人工复核缺陷，减少"AI 说有 bug 其实是 flake"的噪声'
    ],
    weaknesses: [
      '托管服务按 flow 计费，流程越多账单越大',
      '把"什么值得测"的判断外包出去，受监管行业难接受',
      '国内团队用托管服务存在时区与沟通成本'
    ],
    fit: '有明确上线节点、QA 人手不足、能接受外部团队维护套件的产品团队。',
    models: '内置 + 人工复核',
    score: { onboard: 4, cn: 1, eco: 3, model: 3, cost: 3, auto: 5, test: 5, future: 3, compliance: 3 },
    monthlyCost: 0, scriptable: true, cnDirect: false, license: '闭源', pricing: '按量+服务',
    link: 'https://www.qawolf.com/pricing', firstSeen: '2019-01',
    risk: '托管服务按 flow 计价；国内时区与合规成本；判断外包有治理风险',
    capabilities: cap({ req_analysis: 2, testcase_gen: 5, testcase_review: 4, api_auto: 4, ui_auto: 5, defect: 4, code_understand: 2, refactor: 2, cli: 4, ci: 5, scriptable: 4, mcp: 1, skills: 2, multiagent: 3, cron: 3, memory: 3, gui: 5, onboard: 5, model_switch: 1, ecosystem: 3 }),
    provenance: 'official', provenanceNote: '自建平台计量价 1¢/credit + 15¢/runner minute 取自官方 2026-10 定价；托管服务仍为报价制。'
  },
  {
    id: 'katalon', name: 'Katalon', vendor: 'Katalon', letter: 'KA',
    grad: 'linear-gradient(135deg,#7bd389,#0d2f14)',
    kind: 'qa', region: 'global',
    tagline: '低代码到全代码都能写，BYO-LLM 的务实派',
    tags: ['低代码/全代码', 'StudioAssist', 'BYO LLM'],
    what: '老牌测试平台，2026-01 给 StudioAssist 加了可复用 agent profile，每个 profile 能自带 MCP server，也能接 OpenAI / Azure / Gemini / Bedrock 的自家端点。',
    use: '混合技能团队：业务同学用低代码，测试开发写全代码。自带模型端点意味着 token 成本可自己控。',
    strengths: [
      '低代码、脚本、全代码三种写法并存，迁移成本低',
      'BYO-LLM：模型费用走自己合同，不被平台加价',
      '免费档 + Pro 约 $83/席/月（年付 $1000），价格相对透明'
    ],
    weaknesses: [
      '产品线历史包袱重，界面与文档新旧混杂',
      '自愈能力不如 mabl / testRigor 激进',
      '按席位计费，大团队成本线性上升'
    ],
    fit: '已有 Katalon 资产、或需要 BYO-LLM 控制模型成本的中大型团队。',
    models: '自带 OpenAI / Azure / Gemini / Bedrock 端点',
    score: { onboard: 4, cn: 3, eco: 4, model: 4, cost: 4, auto: 4, test: 4, future: 3, compliance: 4 },
    monthlyCost: 602, scriptable: true, cnDirect: false, license: '闭源', pricing: '订阅',
    link: 'https://katalon.com/pricing', firstSeen: '2015-01',
    risk: '按席位计费；自愈能力中等；国内访问一般',
    capabilities: cap({ req_analysis: 2, testcase_gen: 4, testcase_review: 3, api_auto: 4, ui_auto: 4, defect: 3, code_understand: 2, refactor: 2, cli: 4, ci: 5, scriptable: 4, mcp: 4, skills: 3, multiagent: 2, cron: 2, memory: 3, gui: 5, onboard: 4, model_switch: 4, ecosystem: 5 }),
    provenance: 'official', provenanceNote: 'Pro $1000/席/年（约 $83/月）取自官方定价与 2026-10 促销口径；BYO-LLM 见 2026-01 发布说明。'
  },
  {
    id: 'applitools', name: 'Applitools', vendor: 'Applitools', letter: 'AP',
    grad: 'linear-gradient(135deg,#8fd3ff,#08243a)',
    kind: 'qa', region: 'global',
    tagline: '视觉回归的基准线，贵但判得准',
    tags: ['视觉回归', '跨浏览器', 'SDK 低锁定'],
    what: '以视觉 AI 比对为核心的测试平台，Eyes 做跨浏览器 / 设备的视觉回归，Autonomous 让不会写代码的人也能建端到端用例。',
    use: 'UI 改版频繁、设计稿还原要求高的产品；也能用来抓"功能没坏但样式崩了"这类断言抓不到的缺陷。',
    strengths: [
      '视觉比对准确率高，能忽略无害的渲染差异',
      'SDK 形态接入，锁定度低，可只买视觉这一层',
      'Autonomous 让手工测试同学也能建用例'
    ],
    weaknesses: [
      '贵：Eyes Starter 约 $667–899/月，小团队难以承受',
      '只解决视觉层，功能 / 接口仍要别的工具',
      '基线管理需要流程，否则天天被"正常差异"淹没'
    ],
    fit: '有专职 UI、对视觉还原敏感、预算充足的产品团队。别把它当全栈测试平台。',
    models: '内置视觉 AI',
    score: { onboard: 4, cn: 2, eco: 3, model: 3, cost: 1, auto: 4, test: 4, future: 3, compliance: 4 },
    monthlyCost: 4836, scriptable: true, cnDirect: false, license: '闭源', pricing: '订阅',
    link: 'https://applitools.com/pricing/', firstSeen: '2014-01',
    risk: '价格高；只覆盖视觉层；基线维护需要专人',
    capabilities: cap({ req_analysis: 1, testcase_gen: 3, testcase_review: 2, api_auto: 1, ui_auto: 5, defect: 3, code_understand: 1, refactor: 1, cli: 3, ci: 5, scriptable: 3, mcp: 1, skills: 1, multiagent: 2, memory: 2, gui: 5, onboard: 4, model_switch: 1, ecosystem: 4 }),
    provenance: 'mixed', provenanceNote: '官方 Starter 与第三方 $667/$899 口径并存；页面取区间下沿做估算并在文案标注。'
  }
];

add.forEach(t => {
  t.verified = V;
  t.provenance = t.provenance || 'official';
  t.provenanceNote = t.provenanceNote || '';
  if (byId[t.id]) Object.assign(byId[t.id], t);
  else tools.push(t);
});

/* ---- 既有工具的定点修订（价格/改名/口径变化，均有来源） ---- */
const patch = {
  cc: {
    monthlyCost: 145, verified: V,
    pricing: '订阅', tagline: '终端里的资深工程师，仍是事实标准',
    weaknesses: [
      '国内使用要境外网络 + 境外支付，账号风控严格（会查时区、支付地、中转）',
      '贵：Pro $20/月起（约 ¥145），重度用要 Max $100 / $200',
      '2026 年 Anthropic 把 Team 的 Claude Code 席位单独定价（Premium $100–125/席），混编团队要算清'
    ],
    provenanceNote: 'Pro $20 / Max $100 / $200 取自 Anthropic 定价页（2026-10-31 复核）；Team Premium 席位见 2026 年企业定价说明。'
  },
  codex: {
    monthlyCost: 145, verified: V,
    tagline: '跟着 ChatGPT 卖，$20 档的 agent 用量最实在',
    weaknesses: [
      '不单卖：必须挂在 ChatGPT 订阅下，Free / Go 档只有很轻的额度',
      'Pro 档在 2026-09-10 一度暂停新购（Astra 需求过高），$200 / $500 档的可用性要看当时库存',
      'Ultrafast 只在 $500 档，且消耗 8 倍额度'
    ],
    provenanceNote: 'ChatGPT Go $8 / Plus $20 / Pro $100–500 取自 OpenAI 定价页；DevDay 2026-09-29 的 Codex 变更与暂停新购见官方公告与媒体。'
  },
  qcode: {
    name: 'Qoder CN', verified: V, monthlyCost: 59,
    tagline: '通义灵码改名后的样子：Credits 制，Pro ¥59',
    what: '阿里云把通义灵码在 2026-05-20 更名为 Qoder CN，改为 Credits 配额制：体验版 300 credits、社区版 100 credits/月，Pro ¥59、Pro+ ¥169。IDE + 插件 + CLI + 桌面 + 云端多端。',
    risk: 'Credits 口径 2026-05 起变更；社区版补全有限；企业档按席位另计',
    provenanceNote: '更名日期、档位与 Credits 规则取自阿里云官方公告与 2026-10 多方对比。'
  },
  kimicode: {
    verified: V, monthlyCost: 99,
    tagline: '工具白名单最窄，额度却最不像"编程套餐"',
    provenanceNote: '会员档与 Kimi Code 权益取自 Kimi 官网；50 次/天高质量请求为社区实测口径。'
  }
};
Object.entries(patch).forEach(([id, p]) => { if (byId[id]) Object.assign(byId[id], p); });

/* ---- 既有工具补齐 kind / region / alias ---- */
tools.forEach(t => {
  if (!t.kind) t.kind = 'shell';
  if (!t.region) t.region = t.cnDirect ? 'cn' : 'global';
});

fs.writeFileSync(P, JSON.stringify(tools, null, 1));
console.log('tools', tools.length, '| shell', tools.filter(t => t.kind === 'shell').length, '| qa', tools.filter(t => t.kind === 'qa').length);
console.log('cn', tools.filter(t => t.region === 'cn').length, '| global', tools.filter(t => t.region === 'global').length);
