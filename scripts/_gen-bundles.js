#!/usr/bin/env node
/* 组合方案：国际化 + AI 测试平台 + 国内新工具，供诊断台与新页面引用 */
'use strict';
const fs = require('fs');
const path = require('path');
const P = path.join(__dirname, '..', 'data', 'bundles.json');
const B = JSON.parse(fs.readFileSync(P, 'utf8'));
const P2 = path.join(__dirname, '..', 'data', 'plans.json');
const PL = JSON.parse(fs.readFileSync(P2, 'utf8'));
const T = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'tools.json'), 'utf8'));
const tool = id => T.find(t => t.id === id);
const plan = id => PL.find(p => p.id === id);

const add = [
  {
    id: 'b_trae_pro', name: 'Trae + Pro', title: '国内个人最低价的完整 IDE',
    tool: 'trae', plan: 'trae_pro', monthlyCost: 99, tags: ['国内直连', '积分制', 'IDE'],
    summary: '¥99 拿到完整 IDE 与全量高级模型，自带 API Key 还能不扣积分。',
    why: ['Pro 才是能写代码的档，Lite 仅 Work 模式', '自定义模型不扣积分，等于送一个免费壳', '国内直连、人民币付款'],
    watch: '积分是自家记账单位，别拿它和别家比面值；签到积分 10 月起有上限',
    fit: '预算 ¥100 上下、想要 IDE 体验的个人测试。', s: { coding: 7.5, value: 8.5, flex: 7, cn: 9.5, ci: 4, test: 6, ease: 8 },
    costBasis: 'Trae Pro ¥99（含 IDE 与积分池）', toolName: 'Trae', planName: 'Trae Pro', planForm: '积分套餐'
  },
  {
    id: 'b_comate_pro', name: '文心快码 + 专业版', title: '账面额度最大的 ¥59',
    tool: 'comate', plan: 'comate_pro', monthlyCost: 59, tags: ['国内直连', '个人免费档', '单测'],
    summary: '专业版 25000 积分，单测生成与安全扫描是它的强项。',
    why: ['同价位账面额度最大', '个人标准版免费，团队可先白嫖再决定', '国内直连、政企落地多'],
    watch: '官网 ¥59、智能云文档 ¥70，两套价；额度用完限速 150k tokens/h',
    fit: '预算极低、以单测与代码扫描为主的团队。', s: { coding: 7, value: 8, flex: 6, cn: 9.5, ci: 3.5, test: 6, ease: 8.5 },
    costBasis: '专业版 ¥59（官网价；标准价 ¥70）', toolName: '文心快码 Comate', planName: '专业版', planForm: '积分套餐'
  },
  {
    id: 'b_codebuddy_std', name: 'CodeBuddy + 标准版', title: '腾讯栈的流程原生派',
    tool: 'codebuddy', plan: 'codebuddy_std', monthlyCost: 99, tags: ['国内直连', '可脚本化', '小程序'],
    summary: 'CLI 能进 CI，小程序与云开发场景打通，适合腾讯技术栈。',
    why: ['CLI + IDE + 插件三形态，CI 能用', '小程序 / 云开发深度集成', '企业版等保三级'],
    watch: '标准版 4000 积分里一半是活动赠送，促销结束要重新算',
    fit: '腾讯云 / 小程序团队，或需要 CLI 进流水线的国内团队。', s: { coding: 8, value: 7.5, flex: 7.5, cn: 9.5, ci: 7.5, test: 6.5, ease: 7 },
    costBasis: 'CodeBuddy 标准版 ¥99（连续包月 ¥70）', toolName: 'CodeBuddy', planName: '标准版', planForm: '积分套餐'
  },
  {
    id: 'b_codegeex_pro', name: 'CodeGeeX + Pro', title: '内网与信创的最低成本',
    tool: 'codegeex', plan: 'codegeex_pro', monthlyCost: 49, tags: ['国内直连', '可离线', '信创'],
    summary: '¥49，模型可本地部署，代码不出内网。',
    why: ['开源模型可离线部署', '免费档已含全功能', '国内最低价一档'],
    watch: '模型能力与一线有代差，复杂重构会露怯；无 CLI 不能进 CI',
    fit: '内网、信创、教学场景。', s: { coding: 6, value: 9, flex: 5.5, cn: 10, ci: 2.5, test: 5, ease: 8.5 },
    costBasis: 'CodeGeeX Pro ¥49（免费档可先用）', toolName: 'CodeGeeX', planName: 'Pro', planForm: '订阅'
  },
  {
    id: 'b_qoder_plus', name: 'Qoder CN + Pro+', title: '阿里系的重度个人档',
    tool: 'qcode', plan: 'qoder_plus', monthlyCost: 169, tags: ['国内直连', '可脚本化', '多端'],
    summary: '多端覆盖最全，仓库级理解（Repowiki）对大仓友好。',
    why: ['IDE + 插件 + CLI + 桌面 + 云端', 'Repowiki 仓库全局理解', '国内直连、企业可私有化'],
    watch: 'Credits 换算不公开；社区版补全有限',
    fit: '几十万行以上的大仓、需要多端统一的国内团队。', s: { coding: 8.2, value: 7, flex: 8, cn: 9.5, ci: 8, test: 6.5, ease: 6.5 },
    costBasis: 'Qoder CN Pro+ ¥169', toolName: 'Qoder CN', planName: 'Pro+', planForm: 'Credits 套餐'
  },
  {
    id: 'b_claude_pro', name: 'Claude Code + Claude Pro', title: '编码能力的上限',
    tool: 'cc', plan: 'claude_pro', monthlyCost: 145, tags: ['可脚本化', '编码最强', '需境外'],
    summary: '$20 含 Claude Code，Opus 5.5 在复杂重构和失败归因上仍是标杆。',
    why: ['Claude Pro 直接含 Claude Code，只付一次', 'Opus 5.5 的跨文件重构与根因分析最强', 'MCP / Skills / Hooks 生态最成熟'],
    watch: '额度与聊天共享；国内需境外网络 + 支付；风控会查时区与支付地',
    fit: '有海外支付能力、把 AI 当攻坚手的团队。', s: { coding: 9.5, value: 6.5, flex: 7, cn: 1, ci: 9, test: 9, ease: 5.5 },
    costBasis: 'Claude Pro $20 ≈ ¥145（含 Claude Code）', toolName: 'Claude Code', planName: 'Claude Pro', planForm: '订阅'
  },
  {
    id: 'b_chatgpt_plus', name: 'Codex + ChatGPT Plus', title: '云 agent 最顺手的一档',
    tool: 'codex', plan: 'chatgpt_plus', monthlyCost: 145, tags: ['可脚本化', '云 agent', '需境外'],
    summary: '$20 的 Codex 能云端跑任务、自动评审 PR，适合把回归甩给云。',
    why: ['Codex 云任务 + 自动 PR 评审', '与 ChatGPT 全家桶共享', 'DevDay 后支持手机触发云任务'],
    watch: '按消息数限额，云任务消耗更快；Astra 额度很紧',
    fit: '已有 ChatGPT 订阅、想把长任务委派到云的团队。', s: { coding: 9, value: 6.5, flex: 7, cn: 1, ci: 8.5, test: 8, ease: 6 },
    costBasis: 'ChatGPT Plus $20 ≈ ¥145（含 Codex）', toolName: 'Codex', planName: 'ChatGPT Plus', planForm: '订阅'
  },
  {
    id: 'b_copilot_pro', name: 'Copilot + Pro', title: '$10 的合规入场券',
    tool: 'copilot', plan: 'copilot_pro', monthlyCost: 73, tags: ['可脚本化', '最便宜', '需境外'],
    summary: '$10 给 $15 额度，IDE 全覆盖，是团队铺开成本最低的一档。',
    why: ['唯一把"钱换额度"写清楚的厂商', 'VS Code / JetBrains / Xcode 全覆盖', 'Business $19 带 IP 赔付'],
    watch: '个人档默认用你的代码训练（2026-04-24 起），上线前必须关',
    fit: '预算敏感、以补全为主、需要合规票据的团队。', s: { coding: 8, value: 9, flex: 8.5, cn: 1, ci: 7, test: 8, ease: 9 },
    costBasis: 'Copilot Pro $10 ≈ ¥73（含 $15 credits）', toolName: 'GitHub Copilot', planName: 'Copilot Pro', planForm: '订阅'
  },
  {
    id: 'b_cursor_premium', name: 'Cursor + Premium', title: '编辑器党的完整工作台',
    tool: 'cursor', plan: 'cursor_premium', monthlyCost: 218, tags: ['可脚本化', 'IDE', '需境外'],
    summary: '$30 的 Premium 才开放第三方模型，Composer 多文件改写很顺。',
    why: ['$8 档只有 Grok 额度，$30 才开第三方模型', 'Composer 2.5 批量改写快', 'Bugbot 做 PR 缺陷预扫'],
    watch: '第三方模型按 API 原价另算，实际账单常高于标价',
    fit: '愿意换编辑器、日常编码为主的前端 / 全栈测试。', s: { coding: 8.5, value: 5, flex: 8, cn: 1, ci: 6.5, test: 7.5, ease: 7 },
    costBasis: 'Cursor Premium $30 ≈ ¥218（第三方模型另计）', toolName: 'Cursor', planName: 'Cursor Premium', planForm: '订阅'
  },
  {
    id: 'b_muse_high', name: 'Muse Code + High', title: '最便宜的多 agent 终端',
    tool: 'muse', plan: 'muse_high', monthlyCost: 109, tags: ['可脚本化', '多 Agent', '需境外'],
    summary: '$15 给 5 倍额度，多 agent 并行 + 可回放事件日志。',
    why: ['$15 的 5 倍额度，价格锚点最低', '每个 subagent 独立 worktree，事件日志可回放', '适合批量迁移模块'],
    watch: '订阅默认允许 Meta 用你的代码训练；Contributor 折价仅美国账号；无合规背书',
    fit: '个人与小团队、能接受数据换低价。', s: { coding: 8.5, value: 9, flex: 5, cn: 1, ci: 8.5, test: 7.5, ease: 6 },
    costBasis: 'Muse Code High $15 ≈ ¥109', toolName: 'Muse Code', planName: 'Muse Code High', planForm: '订阅'
  },
  {
    id: 'b_grok_premium', name: 'Grok Build + Premium', title: 'X 生态里的便宜 agent',
    tool: 'grok', plan: 'grok_premium', monthlyCost: 218, tags: ['可脚本化', 'X 订阅', '需境外'],
    summary: 'Premium 给 4 倍额度，还带 Grok Bot 与 Cursor Pro 权益。',
    why: ['与 X / Grok 共用一个池', 'Arena 模式多模型竞标', '附带 Grok Bot 与 Cursor Pro 权益'],
    watch: '官方只公布倍数不公布绝对额度；共享池会被聊天消耗',
    fit: '已经在用 X / Grok 的个人与内容团队。', s: { coding: 8, value: 6.5, flex: 5.5, cn: 1, ci: 8, test: 6.5, ease: 6.5 },
    costBasis: 'X Premium $30 ≈ ¥218', toolName: 'Grok Build', planName: 'X Premium', planForm: 'X 订阅'
  },
  {
    id: 'b_kiro_pro', name: 'Kiro + Pro', title: '先出规格再写代码',
    tool: 'kiro', plan: 'kiro_pro', monthlyCost: 145, tags: ['可脚本化', '规格驱动', '需境外'],
    summary: '规格、设计、任务三段留痕，产出本身就是测试依据。',
    why: ['需求→设计→任务三段可评审', 'hooks 在保存等事件触发 agent', 'AWS 生态与合规'],
    watch: 'credits 消耗不直观，大任务一次几百；超额 $0.04/credit',
    fit: '需要评审证据、流程规范的团队。', s: { coding: 8.2, value: 6, flex: 6.5, cn: 1, ci: 8, test: 8.5, ease: 5 },
    costBasis: 'Kiro Pro $20 ≈ ¥145（1000 credits）', toolName: 'Kiro', planName: 'Kiro Pro', planForm: 'Credits 套餐'
  },
  {
    id: 'b_antigravity_pro', name: 'Antigravity + AI Pro', title: '免费档之外最划算的多 agent',
    tool: 'antigravity', plan: 'antigravity_pro', monthlyCost: 145, tags: ['可脚本化', '多 Agent', '需境外'],
    summary: '免费档先用，不够再上 $20；Artifacts 把 agent 产出变成可审阅证据。',
    why: ['免费档 $0 就能跑多 agent', '浏览器录像 / Artifacts 适合测试留痕', 'CLI 与 IDE 同一套 agent'],
    watch: '2026-06-18 免费额度被大幅削减；Ultra 价格多次变动',
    fit: '预算为零先试、再决定是否付费的团队。', s: { coding: 8, value: 9, flex: 6.5, cn: 1, ci: 7.5, test: 8, ease: 7.5 },
    costBasis: 'Google AI Pro $19.99 ≈ ¥145（免费档可先用）', toolName: 'Google Antigravity', planName: 'AI Pro', planForm: 'Google AI 订阅'
  },
  {
    id: 'b_devin_pro', name: 'Devin Desktop + Pro', title: '把长任务甩给云',
    tool: 'devin', plan: 'devin_pro', monthlyCost: 145, tags: ['可脚本化', '云 agent', '需境外'],
    summary: '本地与云端 agent 同一块看板，适合跑一晚上回归。',
    why: ['本地 + 云端统一指挥台', '大仓上下文加载成熟', 'Free 档可先试'],
    watch: '云 agent 按 ACU 另计；JetBrains 插件维护模式',
    fit: 'VS Code 系、有大量可委派长任务的团队。', s: { coding: 8.8, value: 4.5, flex: 7, cn: 1, ci: 8, test: 8, ease: 6 },
    costBasis: 'Devin Desktop Pro $20 ≈ ¥145（云用量另计）', toolName: 'Devin Desktop', planName: 'Devin Pro', planForm: '订阅'
  },
  {
    id: 'b_testrigor', name: 'testRigor Private', title: '维护成本最低的 E2E',
    tool: 'testrigor', plan: 'testrigor_private', monthlyCost: 2175, tags: ['自然语言', '自愈', '报价制'],
    summary: '大白话写用例，自愈 + 视觉兜底，业务同学也能上手。',
    why: ['自然语言写用例，门槛最低', '自愈 + Vision AI 兜底', '能测对话式 AI 功能'],
    watch: '私有档价格不公开，$300 只是第三方下限；小团队偏贵',
    fit: '业务测试占比高、前端迭代快的中大型团队。', s: { coding: 3, value: 3, flex: 4, cn: 1, ci: 8, test: 9.5, ease: 9 },
    costBasis: '第三方口径 $300 ≈ ¥2175/月（官方报价制）', toolName: 'testRigor', planName: 'Private', planForm: '测试平台订阅'
  },
  {
    id: 'b_katalon', name: 'Katalon + Pro', title: 'BYO-LLM 的测试平台',
    tool: 'katalon', plan: 'katalon_pro', monthlyCost: 602, tags: ['低代码', 'BYO-LLM', '按席位'],
    summary: '低代码到全代码都能写，模型费用走自己合同。',
    why: ['低代码 / 脚本 / 全代码三写法', '自带 OpenAI / Azure / Gemini / Bedrock 端点', '价格相对透明'],
    watch: '按席位计费；自愈能力不如 mabl / testRigor 激进',
    fit: '已有 Katalon 资产、需要控制模型成本的中大型团队。', s: { coding: 5, value: 5.5, flex: 8, cn: 4, ci: 9, test: 8.5, ease: 6 },
    costBasis: 'Katalon Pro $83 ≈ ¥602/席/月（年付）', toolName: 'Katalon', planName: 'Katalon Pro', planForm: '测试平台订阅'
  },
  {
    id: 'b_mabl', name: 'mabl Team', title: '一个平台覆盖 Web/API/移动',
    tool: 'mabl', plan: 'mabl_team', monthlyCost: 3263, tags: ['低代码', '自愈', '报价制'],
    summary: '工程主导的统一 E2E，自愈范围广，CI 集成成熟。',
    why: ['Web / API / 移动 / 无障碍一个平台', '自愈范围广', 'CI 集成成熟'],
    watch: '报价制，$450 只是估算下限；canvas / shadow DOM 支持弱',
    fit: '有稳定产品、需要统一 E2E 的中大型团队。', s: { coding: 3, value: 2.5, flex: 5, cn: 1, ci: 9, test: 9.5, ease: 8.5 },
    costBasis: '第三方估算 $450 ≈ ¥3263/月（官方报价制）', toolName: 'mabl', planName: 'Team', planForm: '测试平台订阅'
  }
];

add.forEach(b => {
  const t = tool(b.tool), p = plan(b.plan);
  if (!t) throw new Error('unknown tool ' + b.tool);
  if (!p) throw new Error('unknown plan ' + b.plan);
  const i = B.findIndex(x => x.id === b.id);
  const obj = Object.assign({ id: b.id }, b);
  if (i >= 0) B[i] = obj; else B.push(obj);
});
fs.writeFileSync(P, JSON.stringify(B, null, 1));
console.log('bundles', B.length, '| cn', B.filter(b => (b.tags || []).includes('国内直连')).length);
