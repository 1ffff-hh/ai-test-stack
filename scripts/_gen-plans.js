#!/usr/bin/env node
/* 一次性数据作者脚本：套餐阶梯（国内 + 国际）→ data/plans.json
   汇率：USD→CNY 7.25（页面显式标注，仅用于同表比较）
   原则：price 始终存人民币等值，保证「我的组合」求和口径不变；
        priceLocal + currency 保留原币种，UI 显示 "$20 ≈ ¥145"。 */
'use strict';
const fs = require('fs');
const path = require('path');
const P = path.join(__dirname, '..', 'data', 'plans.json');
let plans = JSON.parse(fs.readFileSync(P, 'utf8'));
const V = '2026-11-01';
const FX = 7.25;

const baseS = { price: 3, predict: 3, model: 3, quota: 3, tool: 3, stable: 3, compliance: 3, test: 3 };
const mk = (o) => {
  const price = o.currency === 'USD' ? Math.round(o.priceLocal * FX) : o.priceLocal;
  const s = Object.assign({}, baseS, o.s || {});
  return Object.assign({
    id: '', name: '', tier: '', vendor: '', price,
    priceNote: '', quota: '', models: '', tools: '', risk: '',
    pros: [], cons: [], s,
    link: '', baseUrl: '', scope: '', modelsCount: 1,
    history: [{ date: V, price, note: '当前价', kind: 'start' }],
    verdict: '', verified: V, tierOrder: 0, type: '订阅',
    form: 'coding', formName: 'Coding Plan',
    quotaUnit: '请求次数', window: '5 小时窗口', overage: '等窗口刷新或升级',
    historyPoints: 1, priceChanges: 0, hasTrend: false,
    currency: o.currency || 'CNY', priceLocal: o.priceLocal,
    region: o.region || 'cn', toolId: o.toolId || '', restrictions: o.restrictions || []
  }, o, { price, s });
};

const add = [
  /* ================= 国内 · 阶梯 ================= */
  mk({
    id: 'trae_lite', name: 'Trae', tier: 'Lite', vendor: '字节跳动', priceLocal: 49, toolId: 'trae',
    priceNote: '仅 Trae Work，不含 IDE 编程', quota: '按月发放积分，Work 模式专用',
    models: '豆包 / DeepSeek 等内置模型', tools: 'Trae Work（不含 TraeCode IDE）',
    risk: '官方套餐表写明「仅 Trae Work」，想写代码必须上 Pro',
    pros: ['最便宜的入口，适合先试 Work 模式'], cons: ['不能用于 IDE 编程', '积分口径不透明'],
    s: { price: 5, predict: 3, model: 3, quota: 2, tool: 1, stable: 3, compliance: 3, test: 1 },
    link: 'https://www.trae.cn/pricing', form: 'coding', formName: '积分套餐',
    quotaUnit: '积分', window: '月', overage: '¥50 / 1000 积分',
    verdict: '¥49 是引流价，不是编程价——这是本页最容易被标题骗的一档。',
    restrictions: ['仅 Work 模式', '积分制']
  }),
  mk({
    id: 'trae_pro', name: 'Trae', tier: 'Pro', vendor: '字节跳动', priceLocal: 99, toolId: 'trae', tierOrder: 1,
    priceNote: '真正能编程的入门档', quota: '按月发放积分，内置模型按 token 扣',
    models: '豆包 / DeepSeek / Kimi / Qwen-Coder / GLM', tools: 'TraeCode IDE + Work',
    risk: '签到积分 2026-10 起设上限；积分用完 ¥50/1000 续',
    pros: ['¥99 用全量高级模型', '自定义模型不扣积分', '国内直连'], cons: ['积分不可跨厂商比价', '重度用会超'],
    s: { price: 4, predict: 3, model: 4, quota: 3, tool: 3, stable: 3, compliance: 3, test: 3 },
    link: 'https://www.trae.cn/pricing', form: 'coding', formName: '积分套餐',
    quotaUnit: '积分', window: '月', overage: '¥50 / 1000 积分',
    verdict: '国内个人档性价比基准线：¥99 拿到多模型 + 完整 IDE。',
    restrictions: ['积分制', '签到有上限']
  }),
  mk({
    id: 'trae_proplus', name: 'Trae', tier: 'Pro+', vendor: '字节跳动', priceLocal: 239, toolId: 'trae', tierOrder: 2,
    priceNote: '积分约为 Pro 的 3 倍', quota: '按 Pro 倍数发放积分',
    models: '同 Pro', tools: 'TraeCode IDE + Work',
    risk: '倍数由官方口径推算，实际扣除随模型浮动',
    pros: ['重度个人开发者够用'], cons: ['与非积分制套餐无法直接比价'],
    s: { price: 3, predict: 3, model: 4, quota: 4, tool: 3, stable: 3, compliance: 3, test: 3 },
    link: 'https://www.trae.cn/pricing', form: 'coding', formName: '积分套餐', quotaUnit: '积分', window: '月', overage: '¥50 / 1000 积分',
    verdict: '给"每天写 4 小时以上"的个人，团队采购直接看企业档。',
    restrictions: ['积分制']
  }),
  mk({
    id: 'trae_ultra', name: 'Trae', tier: 'Ultra', vendor: '字节跳动', priceLocal: 699, toolId: 'trae', tierOrder: 3,
    priceNote: '个人最高档', quota: '大额积分池',
    models: '同 Pro', tools: 'TraeCode IDE + Work',
    risk: '个人档最高价，接近企业席位的 3–4 倍',
    pros: ['个人无需走企业采购'], cons: ['¥699 已可买 3 个 Qoder 团队席位'],
    s: { price: 2, predict: 3, model: 4, quota: 5, tool: 3, stable: 3, compliance: 3, test: 3 },
    link: 'https://www.trae.cn/pricing', form: 'coding', formName: '积分套餐', quotaUnit: '积分', window: '月', overage: '¥50 / 1000 积分',
    verdict: '个人档的天花板；到这个预算，先比较团队席位再决定。',
    restrictions: ['积分制']
  }),
  mk({
    id: 'qoder_plus', name: 'Qoder CN', tier: 'Pro+', vendor: '阿里云', priceLocal: 169, toolId: 'qcode', tierOrder: 1,
    priceNote: 'Credits 约为 Pro 的 4 倍', quota: '大额 Credits / 月',
    models: 'Qwen3-Coder 系 + 可选第三方', tools: 'IDE + 插件 + CLI + 桌面 + 云端',
    risk: '2026-05 起才改 Credits 制，历史文档口径不一致',
    pros: ['多端覆盖最全', '仓库级理解（Repowiki）', '国内直连'], cons: ['Credits 换算不公开', '社区版补全有限'],
    s: { price: 3, predict: 3, model: 4, quota: 4, tool: 4, stable: 4, compliance: 4, test: 3 },
    link: 'https://qoder.com/pricing', form: 'coding', formName: 'Credits 套餐',
    quotaUnit: 'Credits', window: '月', overage: '加购 Credits 或升级企业档',
    verdict: '阿里系的重度个人档，多端与仓库理解是它的差异点。',
    restrictions: ['Credits 制']
  }),
  mk({
    id: 'comate_pro', name: '文心快码 Comate', tier: '专业版', vendor: '百度', priceLocal: 59, toolId: 'comate', tierOrder: 1,
    priceNote: '官网 ¥59，智能云文档标准价 ¥70', quota: '25000 积分 / 月',
    models: '文心 ERNIE 系', tools: '插件 + 独立 IDE',
    risk: '同一档两套官方价；积分面值与 token 不成比例',
    pros: ['同价位账面额度最大', '单测与安全扫描成熟'], cons: ['两套价要做预算取高', '额度用完限速 150k tokens/h'],
    s: { price: 5, predict: 2, model: 3, quota: 4, tool: 2, stable: 3, compliance: 4, test: 3 },
    link: 'https://comate.baidu.com/', form: 'coding', formName: '积分套餐',
    quotaUnit: '积分', window: '月', overage: '切 Auto-Free，限速 150k tokens/h',
    verdict: '账面额度最漂亮的一档，但"25000 积分"不能直接和别家比。',
    restrictions: ['两套官方价', '超额限速']
  }),
  mk({
    id: 'comate_flagship', name: '文心快码 Comate', tier: '旗舰版', vendor: '百度', priceLocal: 299, toolId: 'comate', tierOrder: 2,
    priceNote: '限时价，标准价以官网为准', quota: '大额积分 + 多 Agent',
    models: '文心 ERNIE 系 + 多智能体', tools: '插件 + IDE + 企业能力',
    risk: '限时价随时恢复；企业版另计（¥599/人月）',
    pros: ['多智能体协同', 'F2C 设计稿转代码'], cons: ['价格锚点不稳定'],
    s: { price: 3, predict: 2, model: 4, quota: 4, tool: 3, stable: 3, compliance: 4, test: 3 },
    link: 'https://comate.baidu.com/', form: 'coding', formName: '积分套餐', quotaUnit: '积分', window: '月', overage: '企业档或加购',
    verdict: '多智能体能力在这一档才完整，但限时价不适合做年度预算。',
    restrictions: ['限时价']
  }),
  mk({
    id: 'codebuddy_std', name: 'CodeBuddy', tier: '标准版', vendor: '腾讯云', priceLocal: 99, toolId: 'codebuddy', tierOrder: 1,
    priceNote: '连续包月 ¥70', quota: '4000 积分 / 月（含活动赠送）',
    models: '混元 + DeepSeek 等', tools: '插件 + IDE + CLI',
    risk: '4000 积分里一半是活动赠送，促销结束后以定价页为准',
    pros: ['CLI 能进 CI', '小程序 / 云开发深度打通'], cons: ['积分含赠送', '档位差异不透明'],
    s: { price: 4, predict: 2, model: 3, quota: 3, tool: 4, stable: 4, compliance: 4, test: 3 },
    link: 'https://copilot.tencent.com/', form: 'coding', formName: '积分套餐',
    quotaUnit: '积分', window: '月', overage: '加购积分',
    verdict: '腾讯栈团队的现实选择；买之前问清"赠送到期后给多少"。',
    restrictions: ['积分含活动赠送']
  }),
  mk({
    id: 'codebuddy_adv', name: 'CodeBuddy', tier: '高级版', vendor: '腾讯云', priceLocal: 199, toolId: 'codebuddy', tierOrder: 2,
    priceNote: '约为标准版 2 倍额度', quota: '更大积分池 + 高级模型',
    models: '混元 + DeepSeek 等', tools: '插件 + IDE + CLI',
    risk: '与标准版的真实能力差异官方未逐项列出',
    pros: ['高级模型额度更足'], cons: ['¥99→¥199 的能力跃迁不清晰'],
    s: { price: 3, predict: 3, model: 4, quota: 4, tool: 4, stable: 4, compliance: 4, test: 3 },
    link: 'https://copilot.tencent.com/', form: 'coding', formName: '积分套餐', quotaUnit: '积分', window: '月', overage: '加购积分',
    verdict: '中间档定位尴尬：要么标准版够用，要么直接上企业席位。',
    restrictions: ['积分制']
  }),
  mk({
    id: 'codebuddy_flag', name: 'CodeBuddy', tier: '旗舰版', vendor: '腾讯云', priceLocal: 999, toolId: 'codebuddy', tierOrder: 3,
    priceNote: '个人最高档', quota: '最高积分池 + 全部能力',
    models: '全部可用模型', tools: '插件 + IDE + CLI',
    risk: '¥999 已高于企业 SaaS 席位（¥198/人月）5 倍',
    pros: ['个人可买到全部能力'], cons: ['价格与企业席位倒挂'],
    s: { price: 1, predict: 3, model: 4, quota: 5, tool: 4, stable: 4, compliance: 4, test: 3 },
    link: 'https://copilot.tencent.com/', form: 'coding', formName: '积分套餐', quotaUnit: '积分', window: '月', overage: '企业档',
    verdict: '除非个人报销，否则同样的钱走企业席位更划算。',
    restrictions: ['积分制', '价格与企业席位倒挂']
  }),
  mk({
    id: 'codegeex_pro', name: 'CodeGeeX', tier: 'Pro', vendor: '智谱', priceLocal: 49, toolId: 'codegeex', tierOrder: 1,
    priceNote: '免费档已含全功能', quota: '不限次补全 + 更高模型配额',
    models: 'CodeGeeX 自研开源模型', tools: 'IDE 插件',
    risk: '模型能力与一线有代差；无 CLI / CI',
    pros: ['¥49 最低价', '可本地部署'], cons: ['能力代差', '生态弱'],
    s: { price: 5, predict: 4, model: 2, quota: 4, tool: 1, stable: 3, compliance: 5, test: 2 },
    link: 'https://codegeex.cn/', form: 'coding', formName: '订阅',
    quotaUnit: '请求次数', window: '月', overage: '免费档兜底',
    verdict: '信创 / 内网场景的低价答案，不是能力答案。',
    restrictions: ['能力代差']
  }),
  mk({
    id: 'kimi_pro', name: 'Kimi Code', tier: 'Professional', vendor: '月之暗面', priceLocal: 168, toolId: 'kimicode', tierOrder: 1,
    priceNote: '会员制，Code 额度与会员共享', quota: '50 次高质量请求/天 + 会员额度',
    models: 'Kimi K3.1 Pro', tools: 'Kimi Code 桌面端 / CLI / VS Code 插件',
    risk: '只认自家客户端；非指定工具可能封号；不能进 CI',
    pros: ['1M 上下文', 'Goal Mode'], cons: ['工具白名单最窄', '非按 5 小时窗口'],
    s: { price: 2, predict: 3, model: 4, quota: 3, tool: 1, stable: 4, compliance: 2, test: 1 },
    link: 'https://www.kimi.com/', form: 'member', formName: '会员制',
    quotaUnit: '共享 token 池', window: '会员月 + Code 日限',
    verdict: '长上下文是优点，但"只能用它家客户端"把自动化路堵死了。',
    restrictions: ['仅官方客户端', '禁企业使用']
  }),

  /* ================= 国际 · Claude ================= */
  mk({
    id: 'claude_pro', name: 'Claude', tier: 'Pro', vendor: 'Anthropic', priceLocal: 20, currency: 'USD', region: 'global', toolId: 'cc',
    priceNote: '年付约 $17/月', quota: '5 小时窗口 + 周上限，与聊天共享',
    models: 'Opus 5.5 / Sonnet 5.5 / Haiku', tools: 'Claude Code（终端 + IDE）、网页、桌面',
    risk: '额度与聊天共享；国内需境外网络与支付；Team 的 Code 席位另定价',
    pros: ['$20 档 agent 用量最实在', 'Opus 5.5 编码强', 'Claude Code 生态成熟'],
    cons: ['重度用必须上 $100/$200', '风控严', '不公布 token 数'],
    s: { price: 4, predict: 3, model: 5, quota: 4, tool: 4, stable: 4, compliance: 2, test: 5 },
    link: 'https://www.anthropic.com/pricing', baseUrl: 'https://api.anthropic.com',
    form: 'member', formName: '订阅', quotaUnit: '5 小时窗口', window: '5 小时 + 周',
    verdict: '$20 档的编码天花板，代价是额度与聊天共享、国内不可直连。',
    restrictions: ['需境外网络', '需境外支付', '额度不公开']
  }),
  mk({
    id: 'claude_max5', name: 'Claude', tier: 'Max 5×', vendor: 'Anthropic', priceLocal: 100, currency: 'USD', region: 'global', toolId: 'cc', tierOrder: 1,
    priceNote: '约为 Pro 的 5 倍额度', quota: '5× Pro',
    models: '同 Pro，Opus 额度更高', tools: '同 Pro',
    risk: '周上限仍在；超限只能等或走 API',
    pros: ['重度日常够用'], cons: ['$100 起，个人负担重'],
    s: { price: 2, predict: 3, model: 5, quota: 5, tool: 4, stable: 4, compliance: 2, test: 5 },
    link: 'https://www.anthropic.com/pricing', form: 'member', formName: '订阅', quotaUnit: '5 小时窗口', window: '5 小时 + 周',
    verdict: '每天写 4 小时以上的分水岭档。',
    restrictions: ['需境外网络', '需境外支付']
  }),
  mk({
    id: 'claude_max20', name: 'Claude', tier: 'Max 20×', vendor: 'Anthropic', priceLocal: 200, currency: 'USD', region: 'global', toolId: 'cc', tierOrder: 2,
    priceNote: '团队共享/极重度个人', quota: '20× Pro',
    models: '同 Pro', tools: '同 Pro',
    risk: '仍不承诺无限；多 agent 并行会成倍消耗',
    pros: ['跑并行 agent 的容量'], cons: ['$200 已接近企业席位'],
    s: { price: 1, predict: 3, model: 5, quota: 5, tool: 4, stable: 4, compliance: 2, test: 5 },
    link: 'https://www.anthropic.com/pricing', form: 'member', formName: '订阅', quotaUnit: '5 小时窗口', window: '5 小时 + 周',
    verdict: 'agent 团队共享一个号时的务实档，但要注意多人共用违反条款风险。',
    restrictions: ['需境外网络', '需境外支付', '个人条款']
  }),

  /* ================= 国际 · OpenAI ================= */
  mk({
    id: 'chatgpt_go', name: 'ChatGPT', tier: 'Go', vendor: 'OpenAI', priceLocal: 8, currency: 'USD', region: 'global', toolId: 'codex',
    priceNote: '轻量档，可能含广告', quota: '轻量 Codex + 基础聊天',
    models: 'GPT-6 Luna 等轻量模型', tools: 'Codex CLI / IDE / 网页（限量）',
    risk: '可能展示广告；Codex 额度很轻',
    pros: ['$8 最低门槛'], cons: ['额度不足以日常编码', '可能含广告'],
    s: { price: 5, predict: 2, model: 2, quota: 2, tool: 3, stable: 4, compliance: 2, test: 2 },
    link: 'https://openai.com/chatgpt/pricing/', form: 'member', formName: '订阅', quotaUnit: '消息数', window: '5 小时',
    verdict: '只适合"先试试"，不是编码档。',
    restrictions: ['需境外网络', '可能含广告']
  }),
  mk({
    id: 'chatgpt_plus', name: 'ChatGPT', tier: 'Plus', vendor: 'OpenAI', priceLocal: 20, currency: 'USD', region: 'global', toolId: 'codex', tierOrder: 1,
    priceNote: '$20 档', quota: 'Plus 档 Codex：Sol 约 15–150 条 / 5h',
    models: 'GPT-6.1 Sol / Terra / Luna', tools: 'Codex CLI / IDE / 云 / 桌面',
    risk: '按消息数限额，云任务消耗更快；国内需境外网络与支付',
    pros: ['Codex 云端任务', '自动 PR 评审', '与 ChatGPT 全家桶共享'],
    cons: ['Astra 额度很紧', '不公布 token 数'],
    s: { price: 4, predict: 3, model: 5, quota: 3, tool: 4, stable: 4, compliance: 2, test: 4 },
    link: 'https://openai.com/chatgpt/pricing/', form: 'member', formName: '订阅', quotaUnit: '消息数', window: '5 小时',
    verdict: '与 Claude Pro 同价，选它还是选 Claude 取决于你要云 agent 还是终端深度。',
    restrictions: ['需境外网络', '需境外支付', '额度不公开']
  }),
  mk({
    id: 'chatgpt_pro', name: 'ChatGPT', tier: 'Pro $100', vendor: 'OpenAI', priceLocal: 100, currency: 'USD', region: 'global', toolId: 'codex', tierOrder: 2,
    priceNote: '5× Plus', quota: '5× Plus',
    models: '含 GPT-6 Astra 更高额度', tools: '同 Plus',
    risk: '2026-09-10 曾暂停 $200 档新购，库存会变',
    pros: ['Astra 额度可用'], cons: ['价格是 Plus 的 5 倍'],
    s: { price: 2, predict: 3, model: 5, quota: 4, tool: 4, stable: 4, compliance: 2, test: 4 },
    link: 'https://openai.com/chatgpt/pricing/', form: 'member', formName: '订阅', quotaUnit: '消息数', window: '5 小时',
    verdict: '重度 Codex 用户的第一档升级。',
    restrictions: ['需境外网络', '需境外支付']
  }),
  mk({
    id: 'chatgpt_pro200', name: 'ChatGPT', tier: 'Pro $200', vendor: 'OpenAI', priceLocal: 200, currency: 'USD', region: 'global', toolId: 'codex', tierOrder: 3,
    priceNote: '20× Plus', quota: '20× Plus，桌面语音不限',
    models: '同 Pro', tools: '同 Pro',
    risk: '库存与地区限制；$500 档才有 Ultrafast',
    pros: ['极高额度'], cons: ['个人天花板价'],
    s: { price: 1, predict: 3, model: 5, quota: 5, tool: 4, stable: 4, compliance: 2, test: 4 },
    link: 'https://openai.com/chatgpt/pricing/', form: 'member', formName: '订阅', quotaUnit: '消息数', window: '5 小时',
    verdict: '并行 agent 团队档，个人买要算清楚是否真用满。',
    restrictions: ['需境外网络', '需境外支付']
  }),

  /* ================= 国际 · Copilot ================= */
  mk({
    id: 'copilot_pro', name: 'GitHub Copilot', tier: 'Pro', vendor: 'GitHub', priceLocal: 10, currency: 'USD', region: 'global', toolId: 'copilot',
    priceNote: '$10 含 $15 AI Credits', quota: '1500 credits（=$15）/ 月，补全不限',
    models: '多模型可选（Claude / GPT / Gemini）', tools: 'VS Code / JetBrains / Neovim / Xcode / CLI',
    risk: '个人档默认用你的代码训练（2026-04-24 起），需手动关',
    pros: ['最便宜的付费入口', 'IDE 覆盖最广', '补全不计量'],
    cons: ['agent 额度紧', '训练条款默认开'],
    s: { price: 5, predict: 4, model: 4, quota: 3, tool: 4, stable: 5, compliance: 3, test: 4 },
    link: 'https://github.com/features/copilot/plans', form: 'member', formName: '订阅',
    quotaUnit: 'AI Credits', window: '月', overage: '按模型 token 价计费',
    verdict: '$10 买 $15 额度，是唯一把账算明白的厂商；但先去关训练开关。',
    restrictions: ['需境外网络', '个人档默认用于训练']
  }),
  mk({
    id: 'copilot_proplus', name: 'GitHub Copilot', tier: 'Pro+', vendor: 'GitHub', priceLocal: 39, currency: 'USD', region: 'global', toolId: 'copilot', tierOrder: 1,
    priceNote: '$39 含 $70 AI Credits', quota: '7000 credits（=$70）/ 月',
    models: '全部模型含高级推理', tools: '同 Pro + 完整 agent',
    risk: '额度按 token 扣，重度 agent 仍会超',
    pros: ['额度接近 2 倍价', '高级模型全开'], cons: ['仍非无限'],
    s: { price: 3, predict: 4, model: 5, quota: 4, tool: 4, stable: 5, compliance: 3, test: 4 },
    link: 'https://github.com/features/copilot/plans', form: 'member', formName: '订阅',
    quotaUnit: 'AI Credits', window: '月', overage: '按模型 token 价计费',
    verdict: '重度个人档；如果只是补全，Pro 就够。',
    restrictions: ['需境外网络', '个人档默认用于训练']
  }),
  mk({
    id: 'copilot_max', name: 'GitHub Copilot', tier: 'Max', vendor: 'GitHub', priceLocal: 100, currency: 'USD', region: 'global', toolId: 'copilot', tierOrder: 2,
    priceNote: '$100 含 $200 AI Credits', quota: '20000 credits（=$200）/ 月',
    models: '全部模型 + 优先新模型', tools: '同 Pro+',
    risk: '额度是"钱"不是"次数"，模型越贵扣得越快',
    pros: ['额度 2 倍于价格'], cons: ['个人档最高价'],
    s: { price: 2, predict: 4, model: 5, quota: 5, tool: 4, stable: 5, compliance: 3, test: 4 },
    link: 'https://github.com/features/copilot/plans', form: 'member', formName: '订阅',
    quotaUnit: 'AI Credits', window: '月', overage: '按模型 token 价计费',
    verdict: '把 Copilot 当主力 agent 的人才需要这一档。',
    restrictions: ['需境外网络', '个人档默认用于训练']
  }),

  /* ================= 国际 · Cursor / X ================= */
  mk({
    id: 'cursor_plus', name: 'Cursor（X 订阅）', tier: 'Plus', vendor: 'Anysphere / SpaceX', priceLocal: 8, currency: 'USD', region: 'global', toolId: 'cursor',
    priceNote: '2026-10-12 起新客口径', quota: '共享额度仅覆盖 Grok 系',
    models: 'Grok 4.7 / Composer 2.5；第三方模型另计', tools: 'Cursor 编辑器 + CLI + 后台 agent',
    risk: 'Claude / GPT / Gemini 按 API 原价另算，标价不含它们',
    pros: ['$8 最低的 AI 编辑器入口', 'Composer 多文件改写快'], cons: ['第三方模型另计费', '编辑器锁定'],
    s: { price: 5, predict: 2, model: 3, quota: 2, tool: 3, stable: 4, compliance: 2, test: 3 },
    link: 'https://cursor.com/pricing', form: 'member', formName: '订阅', quotaUnit: '共享池', window: '周',
    verdict: '$8 买到的是 Grok 额度，不是"Claude 随便用"。',
    restrictions: ['需境外网络', '第三方模型另计费']
  }),
  mk({
    id: 'cursor_premium', name: 'Cursor（X 订阅）', tier: 'Premium', vendor: 'Anysphere / SpaceX', priceLocal: 30, currency: 'USD', region: 'global', toolId: 'cursor', tierOrder: 1,
    priceNote: '4× Plus', quota: '4× Plus；才开放第三方模型',
    models: 'Grok 系 + 第三方（按 API 价）', tools: '同上',
    risk: '第三方模型账单不可控',
    pros: ['第三方模型入口', '4 倍额度'], cons: ['实际账单常高于标价'],
    s: { price: 3, predict: 2, model: 4, quota: 3, tool: 3, stable: 4, compliance: 2, test: 4 },
    link: 'https://cursor.com/pricing', form: 'member', formName: '订阅', quotaUnit: '共享池', window: '周',
    verdict: '想用 Claude / GPT 的人，真正起步档是 $30 而不是 $8。',
    restrictions: ['需境外网络', '第三方模型另计费']
  }),
  mk({
    id: 'cursor_super', name: 'Cursor（X 订阅）', tier: 'Super', vendor: 'Anysphere / SpaceX', priceLocal: 100, currency: 'USD', region: 'global', toolId: 'cursor', tierOrder: 2,
    priceNote: '15× Plus', quota: '15× Plus',
    models: '同 Premium', tools: '同上',
    risk: '与 Claude Max / ChatGPT Pro 同价竞争',
    pros: ['编辑器 + agent 一体'], cons: ['同价下模型额度不如专业 agent'],
    s: { price: 2, predict: 2, model: 4, quota: 4, tool: 3, stable: 4, compliance: 2, test: 4 },
    link: 'https://cursor.com/pricing', form: 'member', formName: '订阅', quotaUnit: '共享池', window: '周',
    verdict: '编辑器党的高档位；纯 agent 用户同价有更专的选择。',
    restrictions: ['需境外网络', '第三方模型另计费']
  }),
  mk({
    id: 'cursor_ultra', name: 'Cursor（X 订阅）', tier: 'Ultra', vendor: 'Anysphere / SpaceX', priceLocal: 200, currency: 'USD', region: 'global', toolId: 'cursor', tierOrder: 3,
    priceNote: '50× Plus', quota: '50× Plus',
    models: '同 Premium', tools: '同上',
    risk: '最高档仍不承诺无限',
    pros: ['最高额度'], cons: ['$200 买编辑器额度'],
    s: { price: 1, predict: 2, model: 4, quota: 5, tool: 3, stable: 4, compliance: 2, test: 4 },
    link: 'https://cursor.com/pricing', form: 'member', formName: '订阅', quotaUnit: '共享池', window: '周',
    verdict: '只有把 Cursor 当唯一工作台的人才值。',
    restrictions: ['需境外网络', '第三方模型另计费']
  }),

  /* ================= 国际 · Muse / Grok / Kiro / Devin / Antigravity ================= */
  mk({
    id: 'muse_everyday', name: 'Muse Code', tier: 'Everyday', vendor: 'Meta', priceLocal: 5, currency: 'USD', region: 'global', toolId: 'muse',
    priceNote: '无免费档', quota: '10–50 prompts / 5h',
    models: 'Muse Spark 1.3 / Muse Wonder', tools: 'Muse Code CLI',
    risk: '默认 Contributor 模式 = 允许 Meta 用你的代码训练；Contributor 折价仅美国账号',
    pros: ['$5 最低价的终端 agent', '多 agent + 可回放事件日志'], cons: ['默认训练授权', '只跑 Meta 模型'],
    s: { price: 5, predict: 3, model: 4, quota: 2, tool: 1, stable: 4, compliance: 1, test: 4 },
    link: 'https://dev.meta.ai/products/muse-code', form: 'coding', formName: '订阅', quotaUnit: 'prompts', window: '5 小时',
    verdict: '$5 是真便宜，但"默认拿你的代码训练"要先去设置里关掉。',
    restrictions: ['需境外网络', '默认用于训练', '仅 Meta 模型']
  }),
  mk({
    id: 'muse_high', name: 'Muse Code', tier: 'High', vendor: 'Meta', priceLocal: 15, currency: 'USD', region: 'global', toolId: 'muse', tierOrder: 1,
    priceNote: '5× Everyday', quota: '5× Everyday',
    models: '同 Everyday', tools: '同 Everyday',
    risk: '同上；按量档无消费上限',
    pros: ['$15 的 5 倍额度，价格锚点极低'], cons: ['能力仍受模型单一限制'],
    s: { price: 5, predict: 3, model: 4, quota: 4, tool: 1, stable: 4, compliance: 1, test: 4 },
    link: 'https://dev.meta.ai/products/muse-code', form: 'coding', formName: '订阅', quotaUnit: 'prompts', window: '5 小时',
    verdict: '本页最便宜的"够用档"，前提是你接受 Meta 的训练条款。',
    restrictions: ['需境外网络', '默认用于训练', '仅 Meta 模型']
  }),
  mk({
    id: 'muse_power', name: 'Muse Code', tier: 'Power', vendor: 'Meta', priceLocal: 50, currency: 'USD', region: 'global', toolId: 'muse', tierOrder: 2,
    priceNote: '20× Everyday', quota: '20× Everyday + Muse Wonder Full',
    models: '含 Muse Wonder Full', tools: '同 Everyday',
    risk: 'Muse Wonder Full 不能走 API，只能订阅内用',
    pros: ['最强模型只在档内'], cons: ['模型锁定更深'],
    s: { price: 3, predict: 3, model: 5, quota: 5, tool: 1, stable: 4, compliance: 1, test: 4 },
    link: 'https://dev.meta.ai/products/muse-code', form: 'coding', formName: '订阅', quotaUnit: 'prompts', window: '5 小时',
    verdict: '想用 Wonder Full 就必须买这一档，没有按量替代。',
    restrictions: ['需境外网络', '默认用于训练', '仅 Meta 模型']
  }),
  mk({
    id: 'muse_max', name: 'Muse Code', tier: 'Maximum', vendor: 'Meta', priceLocal: 200, currency: 'USD', region: 'global', toolId: 'muse', tierOrder: 3,
    priceNote: '80× Everyday', quota: '80× Everyday',
    models: '同 Power', tools: '同 Everyday',
    risk: '到顶后只能等刷新，没有更高档',
    pros: ['80 倍额度'], cons: ['$200 与 Claude/ChatGPT 顶档同价'],
    s: { price: 1, predict: 3, model: 5, quota: 5, tool: 1, stable: 4, compliance: 1, test: 4 },
    link: 'https://dev.meta.ai/products/muse-code', form: 'coding', formName: '订阅', quotaUnit: 'prompts', window: '5 小时',
    verdict: '同价位的合规与模型选择都不如 Claude / OpenAI。',
    restrictions: ['需境外网络', '默认用于训练', '仅 Meta 模型']
  }),
  mk({
    id: 'grok_plus', name: 'Grok Build（X 订阅）', tier: 'Plus', vendor: 'xAI', priceLocal: 8, currency: 'USD', region: 'global', toolId: 'grok',
    priceNote: '与 Grok 聊天共享池', quota: 'Basic，共享池',
    models: 'Grok 4.7', tools: 'Grok Build CLI + Grok App',
    risk: '额度与聊天/语音/Imagine 共享；官方不公布绝对请求数',
    pros: ['$8 最低终端 agent 门票', '已在用 X Premium 的人边际成本近零'], cons: ['共享池', '不单卖'],
    s: { price: 5, predict: 2, model: 4, quota: 2, tool: 2, stable: 4, compliance: 2, test: 3 },
    link: 'https://x.ai/cli', form: 'member', formName: 'X 订阅', quotaUnit: '共享池', window: '5 小时',
    verdict: '$8 能用，但别把它当"无限编程"——它是聊天额度的另一个出口。',
    restrictions: ['需境外网络', '需 X 账号', '额度共享']
  }),
  mk({
    id: 'grok_premium', name: 'Grok Build（X 订阅）', tier: 'Premium', vendor: 'xAI', priceLocal: 30, currency: 'USD', region: 'global', toolId: 'grok', tierOrder: 1,
    priceNote: '4× Plus', quota: '4× Plus',
    models: 'Grok 4.7 + Grok Bot', tools: 'Grok Build + Grok Bot + Cursor Pro 权益',
    risk: '捆绑内容多，实际编程额度占比不透明',
    pros: ['含 Grok Bot 与 Cursor Pro 权益'], cons: ['额度仍不透明'],
    s: { price: 4, predict: 2, model: 4, quota: 4, tool: 3, stable: 4, compliance: 2, test: 3 },
    link: 'https://x.ai/cli', form: 'member', formName: 'X 订阅', quotaUnit: '共享池', window: '5 小时',
    verdict: '想要 Grok Bot 的人从这档开始；纯编码用途性价比一般。',
    restrictions: ['需境外网络', '需 X 账号', '额度共享']
  }),
  mk({
    id: 'grok_super', name: 'Grok Build（X 订阅）', tier: 'Super', vendor: 'xAI', priceLocal: 100, currency: 'USD', region: 'global', toolId: 'grok', tierOrder: 2,
    priceNote: '15× Plus', quota: '15× Plus',
    models: '同 Premium', tools: '同上',
    risk: '官方只给倍数，无绝对容量',
    pros: ['高峰优先'], cons: ['与 Claude Max 同价但能力未验证'],
    s: { price: 2, predict: 2, model: 4, quota: 4, tool: 3, stable: 4, compliance: 2, test: 3 },
    link: 'https://x.ai/cli', form: 'member', formName: 'X 订阅', quotaUnit: '共享池', window: '5 小时',
    verdict: 'X 深度用户的档位，编码团队没有理由优先选它。',
    restrictions: ['需境外网络', '需 X 账号', '额度共享']
  }),
  mk({
    id: 'grok_ultra', name: 'Grok Build（X 订阅）', tier: 'Ultra', vendor: 'xAI', priceLocal: 200, currency: 'USD', region: 'global', toolId: 'grok', tierOrder: 3,
    priceNote: '50× Plus', quota: '50× Plus',
    models: '同 Premium', tools: '同上',
    risk: '最高档仍不公布绝对额度',
    pros: ['50 倍额度'], cons: ['$200 无容量承诺'],
    s: { price: 1, predict: 2, model: 4, quota: 5, tool: 3, stable: 4, compliance: 2, test: 3 },
    link: 'https://x.ai/cli', form: 'member', formName: 'X 订阅', quotaUnit: '共享池', window: '5 小时',
    verdict: '除非你是 X 生态重度用户，否则同价选 Claude / Copilot 更稳。',
    restrictions: ['需境外网络', '需 X 账号', '额度共享']
  }),
  mk({
    id: 'kiro_pro', name: 'Kiro', tier: 'Pro', vendor: 'AWS', priceLocal: 20, currency: 'USD', region: 'global', toolId: 'kiro',
    priceNote: '1000 credits / 月，超额 $0.04/credit', quota: '1000 credits',
    models: 'Claude 系 + 开放权重模型', tools: 'Kiro IDE + CLI',
    risk: 'credits 消耗不直观；大任务一次几百',
    pros: ['规格驱动留痕', 'AWS 生态'], cons: ['流程重', '超额不便宜'],
    s: { price: 4, predict: 2, model: 4, quota: 3, tool: 3, stable: 4, compliance: 4, test: 4 },
    link: 'https://kiro.dev/pricing/', form: 'coding', formName: 'Credits 套餐',
    quotaUnit: 'credits', window: '月', overage: '$0.04 / credit',
    verdict: '需要"先出规格再写代码"的团队，它是唯一把这件事做进产品的。',
    restrictions: ['需境外网络', 'credits 制']
  }),
  mk({
    id: 'kiro_power', name: 'Kiro', tier: 'Power', vendor: 'AWS', priceLocal: 200, currency: 'USD', region: 'global', toolId: 'kiro', tierOrder: 1,
    priceNote: '10000 credits / 月', quota: '10000 credits',
    models: '同上', tools: '同上',
    risk: '超额仍按 $0.04',
    pros: ['大团队共享'], cons: ['价格顶到 Claude Max'],
    s: { price: 1, predict: 2, model: 4, quota: 5, tool: 3, stable: 4, compliance: 4, test: 4 },
    link: 'https://kiro.dev/pricing/', form: 'coding', formName: 'Credits 套餐', quotaUnit: 'credits', window: '月', overage: '$0.04 / credit',
    verdict: '合规与流程优先的团队档。',
    restrictions: ['需境外网络', 'credits 制']
  }),
  mk({
    id: 'devin_pro', name: 'Devin Desktop', tier: 'Pro', vendor: 'Cognition', priceLocal: 20, currency: 'USD', region: 'global', toolId: 'devin',
    priceNote: '原 Windsurf Pro', quota: '本地 agent 额度 + 少量云任务',
    models: 'SWE-2 + 第三方', tools: 'Devin Desktop + 云 agent',
    risk: '云 agent 按 ACU 另计；JetBrains 插件维护模式',
    pros: ['本地 + 云端同看板', '大仓上下文'], cons: ['云用量不透明', '非 VS Code 体验断层'],
    s: { price: 4, predict: 2, model: 4, quota: 3, tool: 3, stable: 4, compliance: 3, test: 4 },
    link: 'https://devin.ai/pricing', form: 'coding', formName: '订阅',
    quotaUnit: 'ACU / 请求', window: '月', overage: '按 ACU 计费',
    verdict: '想把长任务甩给云 agent 的团队，先算清 ACU。',
    restrictions: ['需境外网络', '云用量另计']
  }),
  mk({
    id: 'devin_max', name: 'Devin Desktop', tier: 'Max', vendor: 'Cognition', priceLocal: 200, currency: 'USD', region: 'global', toolId: 'devin', tierOrder: 1,
    priceNote: '最高个人档', quota: '最高本地额度 + 更多云任务',
    models: '同上', tools: '同上',
    risk: '云任务仍另计',
    pros: ['云 agent 容量'], cons: ['总成本难封顶'],
    s: { price: 1, predict: 2, model: 4, quota: 5, tool: 3, stable: 4, compliance: 3, test: 4 },
    link: 'https://devin.ai/pricing', form: 'coding', formName: '订阅', quotaUnit: 'ACU / 请求', window: '月', overage: '按 ACU 计费',
    verdict: '只有把云 agent 当半个同事时才值。',
    restrictions: ['需境外网络', '云用量另计']
  }),
  mk({
    id: 'antigravity_pro', name: 'Google Antigravity', tier: 'AI Pro', vendor: 'Google', priceLocal: 19.99, currency: 'USD', region: 'global', toolId: 'antigravity',
    priceNote: '免费档之外的第一档', quota: '更高配额，5 小时刷新',
    models: 'Gemini 3.5 / 3.1 Pro + Claude', tools: 'Antigravity IDE + CLI',
    risk: '配额单位不公开；Ultra 价格 2026 年多次变动',
    pros: ['$20 覆盖 IDE + CLI', 'Artifacts 可复核'], cons: ['免费档随时缩', '配额不透明'],
    s: { price: 4, predict: 2, model: 4, quota: 3, tool: 3, stable: 3, compliance: 2, test: 4 },
    link: 'https://antigravity.google/pricing', form: 'member', formName: 'Google AI 订阅',
    quotaUnit: '配额', window: '5 小时', overage: '升级 Ultra',
    verdict: '免费档够用就先别买；要买也只买这一档。',
    restrictions: ['需境外网络', '配额制']
  }),
  mk({
    id: 'antigravity_ultra', name: 'Google Antigravity', tier: 'AI Ultra', vendor: 'Google', priceLocal: 249.99, currency: 'USD', region: 'global', toolId: 'antigravity', tierOrder: 1,
    priceNote: '$99.99 / $199.99 / $249.99 均有报道，以官网为准', quota: '最高配额 + 第三方模型',
    models: '含第三方模型', tools: '同上',
    risk: '价格在 2026 年内多次变化，是本页最不稳定的一档',
    pros: ['最高配额'], cons: ['价格锚点不稳'],
    s: { price: 1, predict: 1, model: 5, quota: 5, tool: 3, stable: 3, compliance: 2, test: 4 },
    link: 'https://antigravity.google/pricing', form: 'member', formName: 'Google AI 订阅', quotaUnit: '配额', window: '5 小时', overage: '按量',
    verdict: '价格一年三变，采购前必须截图官网现价。',
    restrictions: ['需境外网络', '价格多次变动']
  }),

  /* ================= AI 测试平台 ================= */
  mk({
    id: 'testrigor_private', name: 'testRigor', tier: 'Private', vendor: 'testRigor', priceLocal: 300, currency: 'USD', region: 'global', toolId: 'testrigor',
    priceNote: '第三方口径 $300–900，官方不公开', quota: '按用例 / 执行量',
    models: '内置生成式执行', tools: 'Web / 移动 / API / 桌面',
    risk: '价格不公开，$300 只是第三方下限；免费档用例公开',
    pros: ['自然语言写用例', '自愈 + 视觉'], cons: ['报价制', '复杂场景不精确'],
    s: { price: 1, predict: 1, model: 3, quota: 3, tool: 4, stable: 4, compliance: 3, test: 5 },
    link: 'https://testrigor.com/pricing/', form: 'agent', formName: '测试平台订阅',
    quotaUnit: '用例 / 执行', window: '月',
    verdict: '维护成本最低的一类，但价格要谈到含税年框才算数。',
    restrictions: ['需境外网络', '报价制', '免费档用例公开']
  }),
  mk({
    id: 'mabl_team', name: 'mabl', tier: 'Team', vendor: 'mabl', priceLocal: 450, currency: 'USD', region: 'global', toolId: 'mabl',
    priceNote: '第三方估算 $450–500 起，官方报价制', quota: '按测试量',
    models: '内置', tools: 'Web / API / 移动 / 无障碍',
    risk: '报价制；canvas / shadow DOM 支持弱',
    pros: ['一个平台全覆盖', '自愈范围广'], cons: ['预算难预估', '套件越大越贵'],
    s: { price: 1, predict: 1, model: 3, quota: 3, tool: 4, stable: 5, compliance: 4, test: 5 },
    link: 'https://www.mabl.com/pricing', form: 'agent', formName: '测试平台订阅', quotaUnit: '测试量', window: '月',
    verdict: '中大型团队的统一 E2E 方案，先拿季度报价再谈。',
    restrictions: ['需境外网络', '报价制']
  }),
  mk({
    id: 'qawolf_platform', name: 'QA Wolf', tier: 'Platform', vendor: 'QA Wolf', priceLocal: 0, currency: 'USD', region: 'global', toolId: 'qawolf',
    priceNote: '1¢/AI credit + 15¢/runner minute，无席位费', quota: '按执行分钟计量',
    models: '内置 + 人工复核', tools: 'Playwright 原生，可导出',
    risk: '托管服务按 flow 另计；国内时区成本',
    pros: ['计量透明', '代码可带走'], cons: ['判断外包', '流程越多越贵'],
    s: { price: 4, predict: 3, model: 3, quota: 4, tool: 4, stable: 5, compliance: 3, test: 5 },
    link: 'https://www.qawolf.com/pricing', form: 'paygo', formName: '按量',
    quotaUnit: '分钟 + credits', window: '月', overage: '按量继续',
    verdict: '唯一把"测试"卖成可计量服务的，适合有死线的团队。',
    restrictions: ['需境外网络', '托管服务另计']
  }),
  mk({
    id: 'katalon_pro', name: 'Katalon', tier: 'Pro', vendor: 'Katalon', priceLocal: 83, currency: 'USD', region: 'global', toolId: 'katalon',
    priceNote: '年付 $1000/席，折合约 $83/月', quota: '按席位',
    models: 'BYO-LLM（OpenAI / Azure / Gemini / Bedrock）', tools: 'Web / API / 移动 / 桌面',
    risk: '按席位计费；自愈能力中等',
    pros: ['BYO-LLM 控成本', '低代码到全代码'], cons: ['界面新旧混杂', '大团队线性涨'],
    s: { price: 3, predict: 4, model: 4, quota: 3, tool: 5, stable: 4, compliance: 4, test: 4 },
    link: 'https://katalon.com/pricing', form: 'agent', formName: '测试平台订阅', quotaUnit: '席位', window: '月',
    verdict: '想要"模型费用自己控"的测试平台，它是少数给这个选项的。',
    restrictions: ['需境外网络', '按席位']
  }),
  mk({
    id: 'applitools_starter', name: 'Applitools', tier: 'Eyes Starter', vendor: 'Applitools', priceLocal: 667, currency: 'USD', region: 'global', toolId: 'applitools',
    priceNote: '年付口径 $667/月，月付约 $899', quota: '按视觉检查次数',
    models: '内置视觉 AI', tools: 'Web / 移动 / 跨浏览器',
    risk: '贵；只覆盖视觉层；基线要专人维护',
    pros: ['视觉比对最准', 'SDK 低锁定'], cons: ['价格高', '不覆盖功能/接口'],
    s: { price: 1, predict: 3, model: 3, quota: 3, tool: 3, stable: 5, compliance: 4, test: 4 },
    link: 'https://applitools.com/pricing/', form: 'agent', formName: '测试平台订阅', quotaUnit: '检查次数', window: '月',
    verdict: '只买视觉这一层是合理的；当全栈平台买会失望。',
    restrictions: ['需境外网络', '价格高']
  })
];

/* ---- 既有 12 档补齐 region / toolId / 限制 ---- */
const meta = {
  volc: { toolId: 'dsh', region: 'cn', restrictions: ['仅编程工具内生效', '高峰限流'] },
  huoshan_pro: { toolId: 'dsh', region: 'cn', restrictions: ['仅编程工具内生效'] },
  glm: { toolId: 'zcode', region: 'cn', restrictions: ['仅官方工具', '个人条款'] },
  glm_pro: { toolId: 'zcode', region: 'cn', restrictions: ['仅官方工具', '个人条款'] },
  bailian: { toolId: 'qcode', region: 'cn', restrictions: ['Credits 制'] },
  kimip: { toolId: 'kimicode', region: 'cn', restrictions: ['仅官方客户端', '禁企业使用'] },
  minimax: { toolId: 'mmcode', region: 'cn', restrictions: ['工具白名单'] },
  mm_build: { toolId: 'mmcode', region: 'cn', restrictions: ['工具白名单'] },
  mimo: { toolId: 'mimo', region: 'cn', restrictions: ['模型名变更需改脚本'] },
  dsapi: { toolId: 'dsh', region: 'cn', restrictions: ['按量计费', '无订阅额度'] },
  qoder: { toolId: 'qcode', region: 'cn', restrictions: ['Credits 制'] },
  ark_agent: { toolId: 'dsh', region: 'cn', restrictions: ['Agent 场景专用'] }
};

const ids = new Set(plans.map(p => p.id));
add.forEach(p => {
  if (!p.id) throw new Error('plan missing id: ' + p.name);
  if (ids.has(p.id)) Object.assign(plans.find(x => x.id === p.id), p);
  else plans.push(p);
  ids.add(p.id);
});
plans.forEach(p => {
  const m = meta[p.id];
  if (m) Object.assign(p, m);
  if (!p.region) p.region = 'cn';
  if (!p.currency) p.currency = 'CNY';
  if (p.priceLocal == null) p.priceLocal = p.price;
  if (!p.restrictions) p.restrictions = [];
});

/* 排序：国内在前、按 toolId 聚在一起、同工具按 tierOrder */
const order = {};
plans.forEach((p, i) => { if (order[p.toolId] === undefined) order[p.toolId] = i; });
plans.sort((a, b) => {
  if (a.region !== b.region) return a.region === 'cn' ? -1 : 1;
  const ta = order[a.toolId] ?? 99, tb = order[b.toolId] ?? 99;
  if (ta !== tb) return ta - tb;
  return (a.tierOrder || 0) - (b.tierOrder || 0);
});

fs.writeFileSync(P, JSON.stringify(plans, null, 1));
console.log('plans', plans.length, '| cn', plans.filter(p => p.region === 'cn').length, '| global', plans.filter(p => p.region === 'global').length);
console.log('USD', plans.filter(p => p.currency === 'USD').length, '| CNY', plans.filter(p => p.currency === 'CNY').length);
