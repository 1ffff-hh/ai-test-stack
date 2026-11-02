#!/usr/bin/env node
/* AI 大事：国内外、按时间倒序。每条必须有来源与「对测试的影响」。
   srcType: official=官方公告 / media=媒体报道 / docs=官方文档 */
'use strict';
const fs = require('fs');
const path = require('path');

const events = [
  {
    id: 'n-2026-10-31-hunyuan', date: '2026-10-31', region: 'cn', kind: 'price', weight: 2,
    title: '腾讯混元 Hy3 限免到期，WorkBuddy 每日额度同步收紧',
    body: '混元 Hy3 的夜间限免与每日赠送额度原定 9 月结束，延期到 10-31；WorkBuddy 成长计划的任务奖励仍是 1000+ Credits，但活动页随时可能下线。',
    impact: '如果你的回归脚本靠"限免模型"跑夜班，11 月起会开始计费；把模型名与计费口径写进配置，不要写死在代码里。',
    source: { name: '腾讯混元 / WorkBuddy 活动页', url: 'https://copilot.tencent.com/' }, srcType: 'official',
    tags: ['限免到期', '额度']
  },
  {
    id: 'n-2026-10-27-nanbeige', date: '2026-10-27', region: 'cn', kind: 'model', weight: 1,
    title: '南北阁开源 33B Agent 模型，512K 上下文、Apache 2.0',
    body: '4.3-33B 以 Apache 2.0 开放权重，支持 524,288 token 上下文，定位是"未来更小 agent 的老师"，并计划推出 3B 版本。',
    impact: '又一条可自部署的 agent 底座；对数据不出境的团队，意味着"本地跑 agent"多了一个可选权重，但仍要自己解决工具调用稳定性。',
    source: { name: 'Hugging Face / AI Impact Hub', url: 'https://www.aiimpacthub.com/ai-news/2026-10-27' }, srcType: 'media',
    tags: ['开源', '长上下文']
  },
  {
    id: 'n-2026-10-26-meta-equity', date: '2026-10-26', region: 'global', kind: 'funding', weight: 1,
    title: 'Meta 启动约 350 亿美元股权发行，另设 600 亿美元 ATM 计划',
    body: '用于 AI 基础设施、潜在收购与员工激励；同期还有 10-27 的 Oracle Deep Trust AI 架构、Atos Genesis Intelligence 等企业级动作。',
    impact: '资本继续向算力与 agent 基础设施集中，意味着工具价格战还会继续——但也意味着"免费额度"随时可能被收回。',
    source: { name: 'Meta Investor Relations', url: 'https://investor.atmeta.com/' }, srcType: 'official',
    tags: ['融资', '算力']
  },
  {
    id: 'n-2026-10-24-kimi', date: '2026-10-24', region: 'cn', kind: 'model', weight: 3,
    title: '月之暗面发布 Kimi K3.1 Pro：3 万亿参数、100 万上下文、开源',
    body: '综合智能指数从 44 升到 55，Terminal-Bench 4.0 从 13% 升到 67%；价格约为 GPT-6 Astra 的 1/5。同步完成超 35 亿美元 F 轮，投后估值 350 亿美元，权重计划 11-04 开放。',
    impact: '开源模型第一次在 Terminal-Bench 上接近闭源旗舰。测试团队可以用它做"私有化失败归因"，但 3 万亿参数的部署成本不是个人能承担的。',
    source: { name: '一道科技（转述官方发布）', url: 'https://www.yidaoit.cn/news-2026-10-25-a.html' }, srcType: 'media',
    tags: ['开源', 'Terminal-Bench', '融资']
  },
  {
    id: 'n-2026-10-24-policy', date: '2026-10-24', region: 'cn', kind: 'policy', weight: 3,
    title: '国办印发 AI 就业友好型发展意见，部署 6 方面 18 项任务',
    body: '提出优先在劳动力紧缺、高危岗位推广 AI，稳妥把握劳动密集型行业节奏，鼓励企业建立失业缓冲期、提前告知并提供转岗支持。同日网络安全法修正草案二审，拟增加 AI 安全条款。',
    impact: '这是"AI 冲击测试岗"第一次进入国家层面的就业政策语境。对个人：转岗与技能升级会有政策支持；对企业：裁员流程与告知义务会更受约束。',
    source: { name: '国务院办公厅 / 一道科技转述', url: 'https://www.yidaoit.cn/news-2026-10-25-a.html' }, srcType: 'media',
    tags: ['政策', '就业', '合规']
  },
  {
    id: 'n-2026-10-23-anthropic-ipo', date: '2026-10-23', region: 'global', kind: 'funding', weight: 2,
    title: 'Anthropic 招股书公开、路演推进；与埃森哲签 150 亿美元循环信贷',
    body: '累计锁定 14.8GW 算力资源。此前 10-09 更新使用政策，明确禁止用 Claude 开发武器或使武器发挥作用。',
    impact: '供应商从"创业公司"变成"上市公司"，定价与合规条款会更稳定，但也会更贵、更保守；采购时要把"条款变更提前通知"写进合同。',
    source: { name: '无矩 AI（转述路透）', url: 'https://iaipie.com/' }, srcType: 'media',
    tags: ['IPO', '算力', '合规']
  },
  {
    id: 'n-2026-10-21-mimo', date: '2026-10-21', region: 'cn', kind: 'model', weight: 2,
    title: '小米 MiMo-V2.5 系列正式下线，模型名失效',
    body: 'MiMo-V2.5-Pro 与 V2.5 于 10-21 10:00 下线，需切换到 V2.6 系列；脚本里写死旧模型名会直接报错。',
    impact: '这是"模型下线"最典型的故障源：不是价格问题，是 CI 半夜红。给所有模型名加一个可配置的别名层，并订阅厂商的下线公告。',
    source: { name: '小米 MiMo 官方文档', url: 'https://mimo.mi.com/docs/zh-CN/price/token-plan' }, srcType: 'docs',
    tags: ['下线', '模型名']
  },
  {
    id: 'n-2026-10-19-minimax', date: '2026-10-19', region: 'cn', kind: 'model', weight: 2,
    title: 'MiniMax M3.1 Flash 发布：推理速度近 3 倍，成本降 70%',
    body: '官方称在 agentic 任务、编程与网络安全场景有提升，同时把推理成本压到原来的约 30%。',
    impact: '便宜快模型适合做"第一轮分诊"：先让它把失败用例分组，再把人力和贵模型用在真正的根因上。',
    source: { name: '路透（经 AI Impact Hub 转述）', url: 'https://www.aiimpacthub.com/ai-news/2026-10-27' }, srcType: 'media',
    tags: ['降价', '分诊']
  },
  {
    id: 'n-2026-10-17-gcp-openai', date: '2026-10-17', region: 'global', kind: 'product', weight: 1,
    title: 'Google Cloud 模型花园接入 OpenAI 模型（私有预览）',
    body: 'GPT-6 Astra、GPT-6.1 Sol、GPT-6 Luna 可通过 Google Cloud 的 Model Garden 访问，与其他模型家族并列。',
    impact: '企业采购第一次可以在同一张云合同下选多家模型；对测试团队意味着"换模型"不必换供应商，但账单仍要按模型拆开看。',
    source: { name: 'Google Cloud Blog', url: 'https://cloud.google.com/blog' }, srcType: 'official',
    tags: ['多云', '采购']
  },
  {
    id: 'n-2026-10-15-muse-open', date: '2026-10-15', region: 'global', kind: 'model', weight: 2,
    title: 'Meta 开放 Muse Spark Open 权重：816B 参数、42B 激活、1M 上下文',
    body: '权重上 Hugging Face、SageMaker、Google Cloud Model Garden、Microsoft Foundry；托管 API 在 Baseten、Fireworks、Groq、Modal、Nebius、OpenRouter、Together 可用。许可证是 Muse Model License，不是 Apache / MIT。',
    impact: '开源权重又多一个选择，但许可证有商业限制；"能下载"不等于"能商用"，测试前先读许可。',
    source: { name: 'Meta AI Blog', url: 'https://ai.meta.com/blog/' }, srcType: 'official',
    tags: ['开源', '许可证']
  },
  {
    id: 'n-2026-10-12-x-sub', date: '2026-10-12', region: 'global', kind: 'price', weight: 3,
    title: 'xAI 改卖 X 订阅：Plus $8 / Premium $30 / Super $100 / Ultra $200',
    body: '新客统一走 X 订阅；Grok Build 从 Free 的 "Limited" 到各付费档的 4×/15×/50× 倍数。Premium 起附带 Grok Bot、云 agent 与代码评审。',
    impact: '又一家把"编程 agent"塞进综合订阅。好处是便宜，坏处是额度成为共享池——你无法单独为编码扩容。',
    source: { name: 'xAI / X 订阅页', url: 'https://x.ai/cli' }, srcType: 'official',
    tags: ['改价', '共享池', 'Grok Bot']
  },
  {
    id: 'n-2026-10-12-muse-wonder', date: '2026-10-12', region: 'global', kind: 'model', weight: 1,
    title: 'Meta 发布 Muse Wonder：$4 输入 / $20 输出每百万 token，1M 上下文',
    body: 'Muse Wonder Full 只在 Muse Code 的 Power / Maximum 订阅内提供，不能走 API；同期 Muse Code 订阅档为 $5/$15/$50/$200。',
    impact: '最强模型被锁在订阅里，说明"模型即订阅"的趋势在加强；测试团队无法用 API 复现，只能在客户端内验证。',
    source: { name: 'Meta Developer', url: 'https://dev.meta.ai/products/muse-code' }, srcType: 'official',
    tags: ['模型', '订阅锁定']
  },
  {
    id: 'n-2026-10-09-anthropic-policy', date: '2026-10-09', region: 'global', kind: 'policy', weight: 1,
    title: 'Anthropic 更新使用政策：明确禁止用 Claude 开发武器',
    body: '同时收紧监控与追踪条款。此前 Claude 已加入 Office 插件、非营利插件等企业工作流。',
    impact: 'ToB 采购会越来越看"可接受使用政策"；把 AUP 纳入供应商审查清单，别等法务最后一步才发现不能用。',
    source: { name: 'Anthropic News', url: 'https://www.anthropic.com/news' }, srcType: 'official',
    tags: ['政策', 'AUP']
  },
  {
    id: 'n-2026-10-07-playwright', date: '2026-10-07', region: 'global', kind: 'product', weight: 3,
    title: 'Playwright 1.64 发布，加入 WebMCP：页面可注册工具供 agent 调用',
    body: 'Playwright 自 1.56 起有 planner / generator / healer 三类 Test Agents；1.64 的 WebMCP 让页面把自身能力暴露成工具，agent 不必靠选择器猜。',
    impact: '这是 2026 年对测试最实质的一次底层变化：从"定位元素"转向"调用页面声明的工具"。选择器维护的痛会缓解，但页面要先改造。',
    source: { name: 'Playwright Blog', url: 'https://playwright.dev/blog' }, srcType: 'official',
    tags: ['Playwright', 'WebMCP', 'Test Agents']
  },
  {
    id: 'n-2026-10-sdk', date: '2026-10-01', region: 'cn', kind: 'product', weight: 1, datePrecision: 'month',
    title: 'DeepSeek Harness 以 MIT 开源 v0.1，24 小时揽 7 万星',
    body: 'Harness 团队 2026-03 组建，定位是给各类 LLM 提供统一的"大脑-手脚"协同层，不只服务 DeepSeek 自家模型，也为竞品做兼容层。',
    impact: '国产开源 agent 框架第一次有"平台化"定位；对测试团队，多了一个可审计、可内网部署的壳，但生态还在早期。',
    source: { name: '无矩 AI（转述）', url: 'https://iaipie.com/' }, srcType: 'media',
    tags: ['开源', 'Harness']
  },
  {
    id: 'n-2026-09-29-devday', date: '2026-09-29', region: 'global', kind: 'product', weight: 3,
    title: 'OpenAI DevDay：Codex 上云、语音控制、$500 Pro 档与 Ultrafast',
    body: 'Codex 可在本机、手机远程或云端运行，团队可共享云环境；CLI 加语音与 /agents 视图；Codex Security Cloud 扫描整个 GitHub 仓库；Ultrafast 约 300 tokens/s，只在 $500 档且消耗 8 倍额度。',
    impact: '云任务让"跑一晚上回归、早上看结果"成为默认工作流；但云任务与本地共享额度，容量规划要按"总消耗"而不是"席位数"。',
    source: { name: 'OpenAI', url: 'https://openai.com/index/' }, srcType: 'official',
    tags: ['Codex', '云 agent', 'DevDay']
  },
  {
    id: 'n-2026-09-10-openai-pause', date: '2026-09-10', region: 'global', kind: 'product', weight: 1,
    title: 'OpenAI 暂停 $200 档新购，Astra 需求过高',
    body: '高阶档出现供给约束，$200 / $500 档的可用性随库存变化。',
    impact: '连最大厂商都会"卖断货"，采购计划必须有替代方案；把"同价位备选"写进选型文档。',
    source: { name: '行业媒体综合', url: 'https://techietory.com/?p=53755' }, srcType: 'media',
    tags: ['供给', '备选']
  },
  {
    id: 'n-2026-08-31-muse-ga', date: '2026-08-31', region: 'global', kind: 'product', weight: 2,
    title: 'Muse Code 转正：跨会话消息、Workflow、Rewind 与订阅制',
    body: '订阅 $5 / $15 / $50 / $200 四档；SDK 开发者预览，通过 Muse Session Protocol 在本地 stdio 上编排 agent。',
    impact: '终端 agent 的竞争从"模型能力"转向"可编排性"：事件日志、会话协议、权限控制，这些恰好也是测试最需要的可复现性。',
    source: { name: 'Meta Developer Blog', url: 'https://developer.meta.com/ai/resources/blog/muse-code-new-plans-and-features/' }, srcType: 'official',
    tags: ['Muse', 'SDK', '可编排']
  },
  {
    id: 'n-2026-08-14-cursor', date: '2026-08-14', region: 'global', kind: 'funding', weight: 2,
    title: 'Cursor 被 SpaceX 收购，随后并入 X 订阅体系',
    body: '收购后 Cursor 的模型池改为 Grok 系 + Composer，第三方模型按 API 原价另计；10-12 起新客走 X 订阅 $8/$30/$100/$200。',
    impact: '工具的所有权变化会直接改变你的账单结构；选型文档里要写"如果供应商被收购，我们的退出路径是什么"。',
    source: { name: 'Cursor Blog', url: 'https://cursor.com/blog' }, srcType: 'official',
    tags: ['收购', '改价', '退出路径']
  },
  {
    id: 'n-2026-08-05-muse-beta', date: '2026-08-05', region: 'global', kind: 'product', weight: 1,
    title: 'Meta 发布 Muse Code 测试版，进入终端 agent 竞争',
    body: '由 Muse Spark 1.2 驱动，支持 macOS / Linux（Windows 走 WSL2），默认开启审批与 OS 沙箱。',
    impact: '终端 agent 从"三家竞争"变成"五家以上"，价格与能力都会快速变化；别在一年内把流程锁死在一家。',
    source: { name: 'Meta Developer Blog', url: 'https://prod.developer.meta.com/ai/resources/blog/build-with-muse-code' }, srcType: 'official',
    tags: ['Muse', '终端 agent']
  },
  {
    id: 'n-2026-08-01-cypress', date: '2026-08-01', region: 'global', kind: 'product', weight: 2,
    title: 'Cypress 把 cy.prompt 设为核心功能，并推出 agent-first 的 Cypress Tap',
    body: 'cy.prompt 在所有计划的 Cypress Cloud 上都有计量额度；Tap CLI 以 agent 方式生成与维护测试。',
    impact: '老牌 E2E 工具正式转向"自然语言 + agent"；已在 Cypress 上的团队可以渐进升级，不必重写。',
    source: { name: 'Cypress Blog', url: 'https://www.cypress.io/blog' }, srcType: 'official',
    tags: ['Cypress', 'cy.prompt']
  },
  {
    id: 'n-2026-06-18-gemini-cli', date: '2026-06-18', region: 'global', kind: 'price', weight: 3,
    title: 'Google 把 Gemini CLI 免费额度从约 1000 次/天砍到几十次',
    body: 'Gemini CLI 并入 Antigravity CLI，个人免费用户被引导到 Antigravity 或付费 API Key。',
    impact: '这是"免费额度会消失"最直接的案例：任何建立在免费档上的自动化，都要有付费兜底或替代路径。',
    source: { name: 'Google 开发者论坛 / 多家媒体', url: 'https://antigravity.google/' }, srcType: 'media',
    tags: ['免费额度', '缩水', 'Antigravity']
  },
  {
    id: 'n-2026-06-02-devin', date: '2026-06-02', region: 'global', kind: 'product', weight: 1,
    title: 'Windsurf 改名 Devin Desktop，Cascade 由 Devin Local 接替',
    body: '现有套餐价格不变；JetBrains 插件进入维护模式，官方建议转 ACP。',
    impact: '搜"Windsurf 教程"会看到大量过期内容；团队文档要做一次链接与名词清理，否则新人会照着旧文档操作。',
    source: { name: 'Cognition / Devin FAQ', url: 'https://devin.ai/' }, srcType: 'official',
    tags: ['改名', '文档债']
  },
  {
    id: 'n-2026-06-01-copilot-credits', date: '2026-06-01', region: 'global', kind: 'price', weight: 3,
    title: 'GitHub Copilot 改为 AI Credits 计费：1 credit = $0.01，按 token 扣',
    body: 'Pro $10 含 $15 额度、Pro+ $39 含 $70、Max $100 含 $200；补全在付费档不计量，超额按模型 token 价计费。',
    impact: '从"按请求数"改成"按钱"是最透明的一次计费改革；测试团队终于可以用"每跑一次回归花多少钱"来做预算。',
    source: { name: 'GitHub Blog / Docs', url: 'https://github.blog/changelog/' }, srcType: 'official',
    tags: ['计费', 'Credits', 'Copilot']
  },
  {
    id: 'n-2026-05-20-qoder', date: '2026-05-20', region: 'cn', kind: 'product', weight: 2,
    title: '通义灵码更名为 Qoder CN，转向 Credits 配额制',
    body: '体验版 300 credits、社区版 100 credits/月；Pro ¥59、Pro+ ¥169；IDE + 插件 + CLI + 桌面 + 云端多端。',
    impact: '国产工具从"会员制"集体转向"积分制"；比价难度上升，必须按"同一任务消耗"实测，而不是看面值。',
    source: { name: '阿里云公告 / 多方对比', url: 'https://qoder.com/' }, srcType: 'media',
    tags: ['改名', 'Credits', '国产']
  },
  {
    id: 'n-2026-04-24-copilot-train', date: '2026-04-24', region: 'global', kind: 'policy', weight: 3,
    title: 'GitHub 开始用 Copilot Free / Pro / Pro+ 的交互数据训练模型',
    body: '输入、输出、代码片段与上下文默认纳入训练，可在设置里关闭；Business / Enterprise 不受影响。',
    impact: '"免费/个人档 = 你是训练数据"正在成为行业默认。测试代码里常有生产数据副本，这条比价格更该进评审清单。',
    source: { name: 'GitHub Docs / 隐私更新', url: 'https://docs.github.com/' }, srcType: 'docs',
    tags: ['隐私', '训练条款', '合规']
  },
  {
    id: 'n-2026-05-14-grok', date: '2026-05-14', region: 'global', kind: 'product', weight: 1,
    title: 'xAI 发布 Grok Build 早期测试，先给 $300 Heavy 档',
    body: '5-25 下放到所有 SuperGrok 与 X Premium+；5-29 编码模型 grok-build-0.1 上 API（$1/$2 每百万 token）。',
    impact: '终端 agent 的"价格下放"速度极快：首发专属高价，两周后变成标配。别在首发时签年框。',
    source: { name: 'xAI /  changelog', url: 'https://x.ai/cli' }, srcType: 'official',
    tags: ['Grok', '降价']
  },
  {
    id: 'n-2026-10-06-deepseek', date: '2026-10-06', region: 'cn', kind: 'funding', weight: 2,
    title: 'DeepSeek 接近完成 120 亿美元融资，腾讯与宁德时代参投',
    body: '估值接近 150 亿美元，资金用于模型研发与 2027 IPO 前的市场扩张；同期 Mistral 发布 1 万亿参数开源模型 "Le Chonk"。',
    impact: '开源与闭源的资本差距在缩小；对测试团队，模型选型的"寿命风险"要重新评估——今天的小厂可能是明天的默认供应商。',
    source: { name: 'AI NewsCycle（综合报道）', url: 'https://ainewscycle.com/daily-ai-cloud-intelligence-brief-2026-10-06' }, srcType: 'media',
    tags: ['融资', '开源']
  },
  {
    id: 'n-2026-10-06-watermark', date: '2026-10-06', region: 'global', kind: 'policy', weight: 1,
    title: 'OpenAI 在欧盟上线不可见文本水印，应对 AI 法案',
    body: '用于内容溯源；同期加州立法规范律师使用 AI，要求人类监督。',
    impact: 'AI 生成内容的可追溯性开始有法律要求；测试"AI 生成用例"时，产出是否需要标注来源，会成为新的合规检查项。',
    source: { name: 'AI NewsCycle', url: 'https://ainewscycle.com/daily-ai-cloud-intelligence-brief-2026-10-06' }, srcType: 'media',
    tags: ['水印', '合规', 'EU']
  },
  {
    id: 'n-2026-10-23-llmjacking', date: '2026-10-23', region: 'global', kind: 'security', weight: 2,
    title: 'LLMjacking 攻击转向暴露的 AI 端点：盗凭证、挖矿、账单转嫁',
    body: '研究者报告攻击者劫持公网暴露的模型端点，把算力成本转嫁给所有者；企业开始把 API Key 管控与网络限制纳入 AI 安全基线。',
    impact: '测试环境常把模型端点暴露在公网、Key 写在前端；这类"测试环境被挖矿"的账单事故会越来越多，安全测试要加一条"AI 端点暴露面"。',
    source: { name: 'Help Net Security（经 AI Impact Hub 转述）', url: 'https://www.aiimpacthub.com/ai-news/2026-10-27' }, srcType: 'media',
    tags: ['安全', 'API Key', '成本']
  },
  {
    id: 'n-2026-10-26-meta-shares', date: '2026-10-26', region: 'global', kind: 'funding', weight: 1,
    title: 'Meta 计划新增无投票权股份，为 AI 投入融资',
    body: '用于 AI 投资、潜在收购与员工薪酬；反映算力与人才的资本强度。',
    impact: '巨头的融资动作会传导到工具定价；短期利好是价格战，长期风险是补贴结束后的涨价。',
    source: { name: 'The Verge（经 AI Impact Hub 转述）', url: 'https://www.theverge.com/' }, srcType: 'media',
    tags: ['融资']
  },
  {
    id: 'n-2026-10-23-oracle', date: '2026-10-23', region: 'global', kind: 'product', weight: 1,
    title: 'Oracle 发布 Deep Trust AI 架构：把权限下沉到数据与运行时',
    body: '四层控制覆盖软件、数据、数据访问与应用开发；Atos 同期推出 Genesis Intelligence，支持主权云、本地与气隙部署。',
    impact: '受监管行业的 AI 测试会从"功能对不对"扩展到"权限有没有越界"；测试环境需要能验证数据访问边界，而不只是接口返回。',
    source: { name: 'Oracle / AI Impact Hub', url: 'https://www.aiimpacthub.com/ai-news/2026-10-27' }, srcType: 'media',
    tags: ['企业', '权限', '合规']
  }
];

const kinds = {
  model: { name: '模型', icon: '◇', color: '#3b6ef6' },
  product: { name: '产品', icon: '▣', color: '#0e8a7d' },
  price: { name: '价格', icon: '¥', color: '#b26a00' },
  policy: { name: '政策', icon: '§', color: '#7a4fd6' },
  funding: { name: '资本', icon: '↗', color: '#0f7b4f' },
  security: { name: '安全', icon: '!', color: '#c0392b' }
};

events.sort((a, b) => (a.date < b.date ? 1 : -1));
const out = {
  updated: '2026-11-01',
  intro: {
    title: 'AI 大事：只看会改变你工作方式的那几条',
    lead: '不是资讯搬运。每条都回答同一个问题：这件事对测试/QA 的具体影响是什么。国内与国外分开筛，来源与日期都留在卡片上；没有来源的不写。',
    autoNote: '自动更新管线已接好：scripts/refresh.js 会按 feed-sources.json 抓取官方 RSS / 更新日志，去重后写入 data/news-auto.json；人工条目与自动条目在页面上分开标注。'
  },
  kinds,
  events
};
const P = path.join(__dirname, '..', 'data', 'news.json');
fs.writeFileSync(P, JSON.stringify(out, null, 1));
console.log('news', events.length, '| cn', events.filter(e => e.region === 'cn').length, '| global', events.filter(e => e.region === 'global').length);
