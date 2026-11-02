#!/usr/bin/env node
/* 测试角色阶梯：7 个执行层角色 × 初/中/高，2 个建设层，2 个 AI 层，外加「AI 与测试」四象限 */
'use strict';
const fs = require('fs');
const path = require('path');

const roles = [
  {
    id: 'blackbox', stage: 1, name: '功能测试（黑盒）', en: 'Manual / Black-box QA', icon: '▢',
    oneLine: '从需求和界面出发，证明"用户能不能把事办成"。',
    work: ['需求澄清与测试点拆解', '用例设计与执行', '缺陷提交与回归验证', '上线前冒烟与验收'],
    aiUse: ['从 PRD 生成首轮用例，人补边界与业务规则', '把缺陷单整理成可复现步骤', '截图/录屏自动转步骤描述'],
    human: ['判断"这个行为算不算 bug"', '业务规则冲突时的取舍', '探索性测试与异常路径'],
    metrics: ['缺陷逃逸率', '用例有效性（能抓到 bug 的比例）', '需求覆盖度'],
    tools: ['trae', 'comate', 'wb'], next: 'api', penetration: 55, risk: '压缩',
    riskNote: '纯执行型岗位被压缩最快；能把业务规则讲清楚的人反而更值钱。'
  },
  {
    id: 'whitebox', stage: 1, name: '功能测试（白盒）', en: 'White-box QA', icon: '◧',
    oneLine: '读得懂代码，能从实现里找出测试没覆盖的分支。',
    work: ['代码走查与分支覆盖分析', '单元/集成测试补位', '边界与异常注入', '与开发共同定位根因'],
    aiUse: ['让 agent 读 diff、列出受影响路径', '自动补单测骨架，人补断言', '用变异测试验证用例是否真的有效'],
    human: ['判断哪条分支"值得测"', '设计能证伪的断言', '识别 AI 生成的"假覆盖"'],
    metrics: ['分支/变异覆盖率', '缺陷定位时长', '回归用例的杀伤力'],
    tools: ['cc', 'codex', 'opencode'], next: 'automation', penetration: 62, risk: '升值',
    riskNote: 'AI 能写单测后，"会写"贬值，"知道该断言什么"升值。'
  },
  {
    id: 'api', stage: 1, name: '接口测试', en: 'API Testing', icon: '⇄',
    oneLine: '在 UI 之下验证契约、状态与边界，是自动化性价比最高的一层。',
    work: ['接口契约与错误码梳理', 'pytest/requests 脚本与夹具', '契约测试与 mock', '链路与幂等验证'],
    aiUse: ['从 OpenAPI / 抓包生成用例矩阵', '自动补异常分支与断言', '失败日志的根因分组'],
    human: ['业务状态机的正确性', '跨服务时序与补偿逻辑', '哪些字段可以不稳定'],
    metrics: ['接口覆盖率', '回归稳定率', '平均修复时长'],
    tools: ['dsh', 'codex', 'opencode'], next: 'automation', penetration: 70, risk: '升值',
    riskNote: '最适合先被 AI 吃掉的一层，也是最快能证明 ROI 的一层。'
  },
  {
    id: 'automation', stage: 1, name: '自动化测试', en: 'Test Automation', icon: '⟳',
    oneLine: '把回归变成可重复执行的资产，重点是"稳"而不是"多"。',
    work: ['框架与分层设计', 'Playwright/Cypress 套件', 'CI 集成与并行', 'flake 治理与自愈'],
    aiUse: ['生成/修复定位器与用例', '失败分诊与自愈建议', '把自然语言步骤转成脚本'],
    human: ['框架边界与可维护性', '哪些用例不该自动化', 'flake 的根因判断'],
    metrics: ['套件稳定率', '反馈时长', '维护工时/月'],
    tools: ['cc', 'copilot', 'playwright'], next: 'tool_dev', penetration: 75, risk: '升值',
    riskNote: '写脚本的部分被压缩，设计套件与治理 flake 的部分升值。'
  },
  {
    id: 'performance', stage: 1, name: '性能测试', en: 'Performance Testing', icon: '◔',
    oneLine: '回答"在多少人、多大数据、多长时间下会坏"。',
    work: ['压测模型与场景设计', '脚本与参数化', '瓶颈定位（CPU/IO/锁/GC）', '容量与降级预案'],
    aiUse: ['从链路图生成压测场景草案', '分析火焰图与慢查询', '把指标异常翻译成可执行假设'],
    human: ['压测模型是否代表真实流量', '瓶颈的业务优先级', '容量决策与成本权衡'],
    metrics: ['P95/P99', '错误率拐点', '定位到根因的时长'],
    tools: ['cc', 'kiro', 'devin'], next: 'platform_dev', penetration: 45, risk: '稳定',
    riskNote: 'AI 能帮你分析，但不能替你决定"多少算慢"。'
  },
  {
    id: 'security', stage: 1, name: '安全测试', en: 'Security Testing', icon: '◈',
    oneLine: '从"功能对不对"转向"能不能被越权、被注入、被拿走数据"。',
    work: ['威胁建模与攻击面梳理', '越权/注入/SSRF 验证', '依赖与密钥扫描', 'AI 端点暴露面检查'],
    aiUse: ['从代码与配置生成攻击假设', '辅助 payload 变形', '日志里的异常行为聚类'],
    human: ['攻击链的业务影响判断', '合规与披露决策', 'AI 特有风险（提示注入/越权）'],
    metrics: ['高危漏洞数', '平均修复时长', '攻击面覆盖率'],
    tools: ['cc', 'opencode', 'copilot'], next: 'platform_dev', penetration: 40, risk: '升值',
    riskNote: 'AI 让攻击变快，也让防守方更缺人；这是少数需求在涨的方向。'
  },
  {
    id: 'regression', stage: 1, name: '回归与发布保障', en: 'Regression & Release', icon: '▤',
    oneLine: '决定"这次能不能发"，并让失败可解释。',
    work: ['回归范围与风险分级', '发布检查单与门禁', '灰度/回滚验证', '失败分诊与放行判断'],
    aiUse: ['按 diff 推荐回归范围', '失败聚类与 flake 识别', '生成发布说明与风险摘要'],
    human: ['放行/阻断的最终责任', '跨团队协调', '风险沟通'],
    metrics: ['发布阻断准确率', '逃逸缺陷', '平均恢复时间'],
    tools: ['cc', 'copilot', 'qawolf'], next: 'platform_dev', penetration: 58, risk: '升值',
    riskNote: '执行被自动化，判断与担责不会。'
  },

  {
    id: 'tool_dev', stage: 2, name: '自动化工具开发', en: 'Test Tooling Engineer', icon: '⚒',
    oneLine: '不只写用例，还写"让别人写用例更快"的工具。',
    work: ['测试 CLI / SDK / 插件', '数据工厂与 mock 服务', '报告与失败分析工具', '把 AI 能力封装成团队可用的命令'],
    aiUse: ['生成工具骨架与文档', '把重复脚本抽成库', '自动补测试'],
    human: ['工具边界与 API 设计', '团队工作流的真实痛点', '维护成本控制'],
    metrics: ['工具采纳率', '人均用例产出', '维护工时'],
    tools: ['opencode', 'cc', 'dsh'], next: 'platform_dev', penetration: 68, risk: '升值',
    riskNote: 'AI 让"写工具"的门槛下降，判断"该做什么工具"更稀缺。'
  },
  {
    id: 'platform_dev', stage: 2, name: '自动化平台开发', en: 'Test Platform Engineer', icon: '▦',
    oneLine: '把工具、数据、环境、报告连成一套可运营的系统。',
    work: ['平台架构与多租户', '用例/数据/环境管理', '调度与可观测性', 'AI agent 的接入与治理'],
    human: ['平台边界与演进路线', '成本与稳定性权衡', '跨团队推广'],
    aiUse: ['生成服务骨架与运维脚本', '日志/指标异常分析', '把 agent 接进平台并设权限'],
    metrics: ['平台可用性', '接入团队数', '单次回归成本'],
    tools: ['cc', 'kiro', 'codex'], next: 'ai_test_dev', penetration: 60, risk: '升值',
    riskNote: '平台是少数"越用越值钱"的资产；但要防止做成没人用的内部项目。'
  },

  {
    id: 'ai_test_dev', stage: 3, name: 'AI 测试开发工程师', en: 'AI Test Engineer', icon: '◎',
    oneLine: '既会用 AI 测，也会测 AI；能把非确定性变成可度量的质量。',
    work: ['AI 功能评测集与评分器', '提示注入/越权/幻觉测试', 'agent 工作流回归', '成本与延迟的质量门禁'],
    human: ['定义"什么算好"', '评测集的代表性', '风险分级与放行'],
    aiUse: ['用 LLM-as-judge 做规模化评分', '生成对抗样本', '自动归因失败类型'],
    metrics: ['评测集覆盖', '幻觉/越权检出率', '单次评测成本', '质量门禁拦截率'],
    tools: ['cc', 'testrigor', 'katalon'], next: 'ai_fullstack', penetration: 85, risk: '稀缺',
    riskNote: '2026 年增长最快的测试岗位方向；缺口在"懂业务 + 懂评测"的人，不是会调 API 的人。'
  },
  {
    id: 'ai_fullstack', stage: 3, name: 'AI 全栈工程师', en: 'AI Full-stack Engineer', icon: '◆',
    oneLine: '从模型接入、agent 编排到评测与上线，一个人能闭环。',
    work: ['AI 功能端到端交付', 'RAG / agent / 工具链', '评测与可观测性', '成本、延迟、安全三条线'],
    human: ['产品判断与取舍', '系统边界与失败降级', '对结果负责'],
    aiUse: ['把大部分实现交给 agent，自己做架构与评审', '自动生成评测与回归', '持续重构'],
    metrics: ['交付周期', '线上质量', '单位成本', '故障恢复'],
    tools: ['cc', 'codex', 'muse'], next: null, penetration: 90, risk: '稀缺',
    riskNote: '不是"测试转开发"的替代词，而是"能对 AI 系统负全责"的复合岗。'
  }
];

const levels = [
  {
    id: 'junior', name: '初级', en: 'Junior', years: '0–2 年',
    def: '能按给定用例执行并准确记录结果；知道什么算 bug。',
    evidence: ['能独立完成一个模块的用例执行与缺陷闭环', '缺陷单能被开发直接复现', '会用至少一种工具做接口或 UI 自动化'],
    ai: '用 AI 生成首轮用例与脚本，但必须能指出它错在哪。'
  },
  {
    id: 'mid', name: '中级', en: 'Mid', years: '2–5 年',
    def: '能独立设计测试方案，对覆盖与风险负责。',
    evidence: ['能对一个需求给出测试策略与取舍理由', '能设计稳定的自动化套件并治理 flake', '能主导一次发布保障'],
    ai: '把 AI 当默认工具：生成、分诊、修复；自己定验收标准。'
  },
  {
    id: 'senior', name: '高级', en: 'Senior', years: '5 年以上',
    def: '能定义质量目标，影响架构与发布决策。',
    evidence: ['能建立团队级质量度量并推动改进', '能在架构评审中提出可测性要求', '能培养中级并沉淀方法'],
    ai: '设计"人 + agent"的协作边界与评审门禁，对 AI 产出负最终责任。'
  }
];

const matrix = {
  note: '同一角色在不同级别，差别不是"做得多快"，而是"对什么负责"。AI 把执行层拉平后，级别差异更多体现在判断与担责。',
  rows: [
    { role: 'blackbox', cells: [
      { l: 'junior', d: '按用例执行，记录结果', ai: 'AI 生成用例，人执行并挑错' },
      { l: 'mid', d: '设计用例与优先级', ai: 'AI 出草案，人补业务规则与边界' },
      { l: 'senior', d: '定义验收标准与风险策略', ai: 'AI 做覆盖分析，人决定"测到什么程度为止"' }
    ] },
    { role: 'whitebox', cells: [
      { l: 'junior', d: '能读懂被测代码', ai: 'AI 解释代码与调用链' },
      { l: 'mid', d: '补单测、做分支覆盖', ai: 'AI 生成单测骨架，人补断言' },
      { l: 'senior', d: '用变异测试证明用例有效', ai: 'AI 跑变异与归因，人判断等价 mutants' }
    ] },
    { role: 'api', cells: [
      { l: 'junior', d: '按接口文档写用例', ai: 'AI 从 OpenAPI 生成用例矩阵' },
      { l: 'mid', d: '设计状态机与异常分支', ai: 'AI 补异常分支，人校验业务语义' },
      { l: 'senior', d: '定契约与治理策略', ai: 'AI 做契约 diff，人决定兼容边界' }
    ] },
    { role: 'automation', cells: [
      { l: 'junior', d: '写/修脚本', ai: 'AI 生成与修复定位器' },
      { l: 'mid', d: '分层设计与 flake 治理', ai: 'AI 分诊失败，人判断根因' },
      { l: 'senior', d: '套件资产化与 ROI', ai: 'AI 算维护成本，人决定砍哪些用例' }
    ] },
    { role: 'performance', cells: [
      { l: 'junior', d: '执行压测脚本', ai: 'AI 生成场景草案' },
      { l: 'mid', d: '瓶颈定位', ai: 'AI 分析火焰图/慢查询' },
      { l: 'senior', d: '容量与成本决策', ai: 'AI 给曲线，人定容量' }
    ] },
    { role: 'security', cells: [
      { l: 'junior', d: '跑扫描、复现已知漏洞', ai: 'AI 解释漏洞与修复' },
      { l: 'mid', d: '越权/注入验证', ai: 'AI 生成攻击假设与 payload' },
      { l: 'senior', d: '威胁建模与合规决策', ai: 'AI 做攻击面梳理，人定风险接受' }
    ] },
    { role: 'regression', cells: [
      { l: 'junior', d: '执行回归、记录结果', ai: 'AI 按 diff 推荐范围' },
      { l: 'mid', d: '发布检查单与门禁', ai: 'AI 聚类失败、识别 flake' },
      { l: 'senior', d: '放行/阻断与风险沟通', ai: 'AI 出风险摘要，人担责' }
    ] }
  ]
};

const relation = {
  title: 'AI 与测试的关系，其实是四件事',
  lead: '很多讨论把"AI 测试"混成一团。拆开看只有四象限：AI 当工具、AI 当被测对象、AI 当同事、AI 当风险源。四件事的能力、工具、指标都不一样。',
  quads: [
    {
      id: 'use', name: '用 AI 测', en: 'AI as a tool', icon: '①',
      what: '把 AI 放进现有测试流程，提升生成、执行、分诊的效率。',
      examples: ['从 PRD 生成用例', '失败日志根因分组', '定位器自愈', '测试数据合成'],
      metrics: ['用例产出/人日', '维护工时', '反馈时长'],
      fail: '只做"生成"不做"验证"，产出大量通过但没证明任何事的用例（completion theater）。',
      tools: ['cc', 'copilot', 'trae', 'testrigor']
    },
    {
      id: 'test', name: '测 AI', en: 'AI as SUT', icon: '②',
      what: '把 AI 功能当成被测系统：非确定性、幻觉、越权、提示注入、成本与延迟。',
      examples: ['评测集与评分器', '对抗样本', '提示注入/越权', 'RAG 召回质量', 'token 成本回归'],
      metrics: ['幻觉检出率', '越权拦截率', '评测集覆盖', '单次评测成本'],
      fail: '用"看起来合理"当通过标准；没有基线、没有评分器、没有回归集。',
      tools: ['testrigor', 'katalon', 'cc']
    },
    {
      id: 'with', name: '与 AI 协作', en: 'AI as teammate', icon: '③',
      what: '把 agent 当同事：给它上下文、权限、验收标准，并对它的产出做评审。',
      examples: ['agent 跑回归并分诊', '多 agent 并行修用例', 'MCP 接内部系统', 'review gate'],
      metrics: ['agent 任务完成率', '人工返工率', '评审拦截率'],
      fail: '把 agent 当"自动完成按钮"，不给边界也不做评审，最后花更多时间收拾。',
      tools: ['cc', 'muse', 'codex', 'opencode']
    },
    {
      id: 'risk', name: '防 AI 风险', en: 'AI as risk', icon: '④',
      what: 'AI 进入研发链路后新增的风险：代码缺陷、数据泄露、供应链、端点暴露。',
      examples: ['AI 代码缺陷率', '训练数据条款', 'API Key 与端点暴露', '依赖供应链', '生成内容合规'],
      metrics: ['AI 代码缺陷密度', '敏感数据外发事件', '暴露面数量'],
      fail: '只测功能，不看"这段代码是谁写的、用了谁的模型、数据去了哪"。',
      tools: ['copilot', 'cc', 'opencode']
    }
  ]
};

const sources = [
  { n: 'PractiTest · State of Testing 2026', d: '76.8% 测试团队已用 AI；用例创建 69.6%、维护 59.6%、风险识别仅 19.9%；68.9% 从业者"非常担心"未来。', u: 'https://www.practitest.com/state-of-testing/' },
  { n: 'Capgemini / OpenText / Sogeti · World Quality Report 2025-26', d: '89% 组织在 QE 中试点或部署 GenAI，37% 进生产、15% 企业级规模化；平均生产力提升 19%，三分之一收效甚微；63% 企业把 GenAI 列为质量工程师必备技能。', u: 'https://www.capgemini.com/insights/research-library/world-quality-report/' },
  { n: 'Google Cloud · DORA 2025', d: 'AI 是放大器：在自动化测试、版本控制与快速反馈不成熟的团队，AI 会降低交付稳定性。', u: 'https://cloud.google.com/blog/products/devops-sre/announcing-the-2025-dora-report' },
  { n: 'Forrester · 2026 软件测试自动化报告（转述）', d: '2026 Q1 QA 岗位需求同比下降 18%，"测试策略架构师"类岗位同比上升 24%。', u: 'https://www.forrester.com/' },
  { n: 'Challenger, Gray & Christmas', d: '2026 上半年美国宣布的 443,604 个裁员中，101,743 个（约 23%）把 AI 列为原因，连续四个月是第一大原因。', u: 'https://www.challengergray.com/' },
  { n: 'GitClear 2026 / 行业汇总', d: '复制粘贴代码占新增代码 15.7%；掩盖错误的写法增加 47%；AI 生成代码缺陷约为 1.7 倍，逻辑错误多约 75%；45.2% 开发者称调试 AI 代码更慢。', u: 'https://www.gitclear.com/' }
];

fs.writeFileSync(path.join(__dirname, '..', 'data', 'roles.json'), JSON.stringify({
  updated: '2026-11-01',
  intro: {
    title: '测试的岗位阶梯，正在从"执行"改成"判断"',
    lead: '这张图回答三个问题：现在有哪些测试岗、每一级到底差在哪、AI 把哪一段吃掉了。7 个执行层角色 × 初/中/高，加 2 个建设层与 2 个 AI 层。所有"渗透度"都是本站判断，不是厂商数据；判断依据写在每张卡的风险说明里。'
  },
  stages: [
    { id: 1, name: '执行层', desc: '对"这一次测什么、测得对不对"负责' },
    { id: 2, name: '建设层', desc: '对"让别人测得更快、更稳"负责' },
    { id: 3, name: 'AI 层', desc: '对"AI 系统的质量"负全责' }
  ],
  roles, levels, matrix, relation, sources
}, null, 1));
console.log('roles', roles.length, '| levels', levels.length, '| quads', relation.quads.length);
