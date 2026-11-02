# 维护与发布手册

> 面向接手的人（包括三个月后的自己）。读完这一篇就能改数据、跑门禁、发版、回滚。
> 相关文档：`README.md`（站内结构与概念）、`CONTRIBUTING.md`（外部贡献者视角）、
> `SECURITY.md`（报告通道）、`docs/PRODUCT-v6.md`（为什么做这些）、`docs/ACCEPTANCE-v7.md`（验收记录）。

---

## 0. 一句话

这个站不靠「写得勤」活着，靠**三层分离 + 四道门禁 + 两条自动化**：
改数据不用碰代码，改代码不用碰数据，发布前机器替你检查，每周一自动抓一次、每次推送自动部署一次。

---

## 1. 为什么它不会烂掉

| 设计 | 解决的问题 | 在哪 |
|---|---|---|
| **数据 / 模板 / 构建 三层分离** | 改价格不用读 JS，改样式不用翻 JSON | `data/*.json` + `src/*` + `build.js` |
| **站内数字全部运行时算** | 加了条目忘了改文案，页面不会自相矛盾 | `src/app.js`；模板里没有硬编码计数 |
| **构建期数据校验** | 坏数据进不了页面，而不是上线后才发现 | `build.js`：字段、来源等级、夺冠率、过期优惠 |
| **数据新鲜度自曝** | 数据旧了自己说，不等用户发现 | `meta.lastVerified` + `staleAfterDays` → 页面标黄 + `#health` |
| **脱敏扫描** | 本机路径、会话 ID、密钥进不了公开仓库 | `scripts/check-pii.js`（含自检） |
| **四道门禁一条命令** | 交接给下一个人时不用口头描述「要测什么」 | `npm run check` |
| **每周一自动抓取 + 每次推送自动部署** | 没人管也会动；动了也不会发坏版本 | `.github/workflows/data-refresh.yml`、`pages.yml` |
| **标题、分享卡、摘要由数据生成** | 条目数变了，meta 不会还写着「29 款」 | `build.js` 的 `/*__META__*/` 注入 |
| **订阅源与站点地图构建期生成** | 站每周在变，但不该靠用户想起来才回来看 | `scripts/build-feed.js`、`scripts/build-site.js` |
| **每日探活** | 站点挂了、产物缺了，不会自己喊人 | `.github/workflows/uptime.yml` |
| **页面上就能报错** | 看到错价的人当场能说，不用先找到邮箱 | 命令面板 / 页脚 / 数据健康页，均带 `data-fix` |

**这个项目最容易坏的地方不是代码，是数据信任。** 所以维护的重心永远在：一条价格错了，多久能被发现、被谁发现。

---

## 2. 三层结构：改哪一层

```
data/*.json      ← 内容。价格、额度、新闻、角色、评测用例、来源
src/*            ← 模板。index.html 骨架 + 6 层 CSS + app.js 渲染逻辑
build.js         ← 构建。读 data、校验、把 CSS+数据+JS 内联进根目录 index.html
```

改动的辐射范围：

| 你改了什么 | 要做什么 | 会不会影响别的页面 |
|---|---|---|
| `data/plans.json` 的某个价格 | 改 `price`、`verified` → `node build.js` | 会自动反映到套餐页、组合页、诊断报告、导出文件 |
| 加一款工具 | `data/tools.json` 追加 → 见 `README.md` 的必填字段表 | 工具库、矩阵、PK、诊断、导出全都会多一条 |
| 加一条新闻 | `data/news.json` 追加，**必须写「对测试的影响」** | 只影响 AI 大事页 |
| 改样式 | `src/v7.css`（或对应层）→ `node build.js` | 全站，必须重跑对比度审计 |
| 加一个功能页 | `data/modules.json` 挂到某个模块 + `src/app.js` 注册视图 + `build.js` 的 `FEATURE_VIEW_IDS` | 导航、地图、404 页、验收断言都要同步 |

**数字不要写死在文案里。** 模板里凡是「29 款工具」这类数字都应当来自数据；历史上的
「33 条免费额度」文案错了一轮，就是因为写死了。

---

## 3. 日常更新（四种场景，照着做）

### 3.1 核一条价格（最高频）

```bash
# 1) 打开官网定价页确认当前价格
# 2) 改 data/plans.json：price / quota / 限制，并把 verified 改成今天
# 3) 重建
node build.js
# 4) 四道门禁
npm run check
# 5) 提交
git add data/ index.html exports/
git commit -m "data: 火山方舟 Lite 40 → 50（2026-11-02 核验）"
```

价格历史顺手记进该条的 `history` 数组。这一处写入会同时喂到四个地方：
套餐页的走势图、「更新日志」页的最近变化时间线、Atom 订阅源、
以及 `exports/plans-history.csv`（一行一次记录）。所以**别只改 `price` 不写 `history`**：
页面上的当前价会变，但「什么时候变成这样的」就没人知道了。

```json
"history": [
  { "date": "2026-07-31", "price": 118, "note": "涨价 140.8%" },
  { "date": "2026-11-02", "price": 128, "note": "再涨 8.5%" }
]
```

### 3.2 加一条新闻

`data/news.json` 追加一条，字段照现有条目写。**人工条目必须写「对测试的影响」**——
只有标题没有影响的，等于没有信息。自动抓取的条目永远单独放在 `news-auto.json`，
默认不显示，不要手工往里搬。

### 3.3 加一条评测用例

`data/evalset.json` 追加，`build.js` 会校验：6 类每类 ≥4 条、id 唯一、`severity ∈ {P0,P1,P2}`、
字段（input / expected / oracle / tags）齐全。类别要新增的话，同时改构建期的类别白名单与页面筛选条。

### 3.4 改文案与样式

- 文案：动 `src/index.html` 或 `src/app.js` 里的字符串；**不要动根目录 `index.html`**，它是产物，会被覆盖。
- 样式：动 `src/v7.css`。规矩只有一条——写 `color` 用 `-t` 结尾或 `--cN` 变量，
  写 `background` / `border` / `gradient` 用不带后缀的主色。违反就会在浅色主题下糊成一片，
  `a11y-audit.js` 会拦下来。

---

## 4. 数据会不会过期，谁来说

三层可靠性依次下降，所以分开报告——这比「一个总成功率」有用：

| 层 | 检查什么 | 可靠性 | 会不会自动改数 |
|---|---|---|---|
| L1 新鲜度 | 每个数据集最后核验日、距今天数、是否 >30 天 | 100% | 否 |
| L2 新闻 RSS | 12 个源，去重 + 标题过滤 + 标题党过滤 | 高 | 只写 `news-auto.json` |
| L3 价格指纹 | 14 个定价页的文本哈希与价格串快照 | 尽力而为 | **只告警，不改价** |

跑一次：

```bash
npm run refresh          # 抓 RSS + 价格指纹，写盘
npm run refresh:dry      # 只看差异
npm run refresh:offline  # 不联网，只做新鲜度报告
```

抓失败是正常的（403 / timeout / TLS 都会发生），`#health` 页会**照实列出来，不隐藏**。
维护动作就一句话：**打开 `#health`，看「核价与抓取待办」，按它列的顺序核。** 待办可以一键复制成 Markdown。

> 为什么不自动改价：自动解析会把「$20 起」读成「$20」、把「原价 ¥60」读成「现价 ¥60」。
> 抓错一个价格，比不更新更糟。这条边界不要动。

---

## 5. 发布到 GitHub Pages

站点是零依赖静态文件，发布就是把 `_site/` 交给 Pages。工作流已经写好：
**推送到 `main` → 自动跑四道门禁 → 生成 `_site/` → 部署**。门禁不过就不部署，站点停在上一版。

### 5.1 本地预览「部署后的样子」

```bash
npm run preview
```

它做四件事：重建 `index.html` → 生成 `_site/`（见下表）→ 渲染分享图 → 用 http 在
<http://localhost:4173/ai-test-stack/> 端起来——**带着子路径**，和 Pages 一致。

（子路径从 `git remote origin` 推出来。根路径下预览会看不出相对链接、404 和
Service Worker 作用域的问题，那样预览就只是「看起来像」。）

`_site/` 里有什么，谁生成的：

| 产物 | 作用 | 由谁生成 | 缺了会怎样 |
|---|---|---|---|
| `index.html` | 站点本体 | `build.js` | 什么都没了 |
| `exports/*` | 6 个可下载数据集（含 `plans-history.*`） | `build.js` | 下载链接 404 |
| `feed.xml` | Atom 订阅 | `scripts/build-feed.js` | 订阅者永远收不到更新 |
| `sitemap.xml` | 站点地图 | `scripts/build-site.js` | 搜索收录变慢（不致命） |
| `og.png` | 分享卡片大图 | `scripts/build-og.js` | 分享出去没有图，卡片退化成小卡 |
| `sw.js` | 离线缓存 | `scripts/build-site.js` | 只有 `file://` 能离线，网页版不行 |
| `404.html` | 未知路径兜底 | `scripts/build-site.js` | Pages 用默认 404，用户看到死路 |

`build-site.js` 会自检：产物缺一个、`index.html` 里缺 `canonical` / `og:image` / JSON-LD、
或找不到指向仓库的纠错入口，都直接 `exit 1`。**`npm run check` 的最后一步就是它**，
所以门禁绿 = 发布物齐。

`og.png` 是唯一可能被跳过的：它要起真浏览器。本地没装 Playwright 时它会打一行「已跳过」，
不阻塞；线上工作流装了 Playwright，所以线上一定有图。想在本机补：
`npm run og`（需要 `npx playwright install chromium`）。

**为什么分享图要现渲染而不是放一张静态图**：图上的「29 款工具」这类数字必须跟数据同步。
手写一张图，等于在图片里埋一个永远不会被校验发现的事实错误。

**为什么不能只看 `file://`**：本地双击打开走的是 `file://`，Pages 走的是 `https://<user>.github.io/<repo>/`
子路径。相对链接、下载路径、`404.html` 只有在 http + 子路径下才是真实表现。

### 5.2 首次发布（只做一次）

```bash
# 1) 确认门禁全绿
npm run check

# 2) 先开一条干净的公开历史（怎么做、为什么，见第 6 节）
git checkout --orphan main
git rm -r --cached docs/internal
git add -A
git commit -m "public release: v2.2.0"

# 3) 建公开仓库并关联远端（--push 不要加，先不推）
gh repo create ai-test-stack --public --source=. --remote=origin \
  --description "AI 工具选型 × 测试角色 × AI 冲击决策站：单文件、零依赖、可离线打开"

# 4) 打开 Pages，来源选 GitHub Actions
#    空仓库也能开 —— 先开再推，第一次部署就能成功，不用事后补跑
gh api --method POST repos/1ffff-hh/ai-test-stack/pages \
  -f build_type=workflow

# 5) 推送。这一下就自动触发 pages.yml：门禁 → 构建 _site → 部署
git -c credential.helper='!gh auth git-credential' push -u origin main
gh run list --limit 3          # 看这次部署
```

站点地址：<https://1ffff-hh.github.io/ai-test-stack/>

> **第 5 步为什么带 `-c credential.helper=...`**：机器上装了 Git Credential Manager 时，
> 它会想弹一个图形窗口要账号，命令行里会直接卡住。临时指定用 `gh` 的凭据就绕过去了。
> 想以后 `git push` 都不用带这一串，装一次凭据助手即可：
>
> ```bash
> gh auth setup-git
> ```

### 5.3 之后每次发布

```bash
node build.js                 # 改了 src/ 或 data/ 才需要
npm run check                 # 四道门禁
git add -A && git commit -m "..."
git push                      # 推送即部署
gh run watch                  # 看这次部署的进度（可选）
```

改了数据还要提交产物：`index.html`、`exports/*`（构建期重新生成的）。

### 5.4 回滚

Pages 部署的是一个 artifact，回滚最快的方式是**把代码退回去再推一次**：

```bash
git revert <坏提交>           # 生成一个反向提交，历史保留
npm run check
git push
```

不要用 `git reset --hard` 强推 `main`——线上站和本地历史会脱节，下一个人接手时看不懂。

---

## 6. 脱敏：发布红线

公开仓库里**不允许**出现：

<!-- pii-scan:off —— 下面在举例说明要拦什么，本身是占位符不是真数据 -->
- 本机绝对路径（`C:\Users\<你的名字>\...`、`/c/Users/<名字>/...`、`D:\Desktop\...`）
- 任何会话 ID、聊天记录路径、其他 AI 工具的工作目录
- 密钥、token、私钥
- 私人邮箱（机器人地址和 `@users.noreply.github.com` 除外）
<!-- pii-scan:on -->

`scripts/check-pii.js` 会拦住这四类，并且**它自己带自检**（`--self-test`：每条规则必须先能抓到一条样例，
否则扫描器自己失败）。一个只会输出 0 的检查器等于没有检查器 —— 这条路这个项目踩过。

内部材料（交接报告、错误日志、验收草稿）放 `docs/internal/`，该目录已被 `.gitignore` 忽略，
公开仓库里不出现，本地文件保留。

**历史也是内容。** 本地开发过程中的提交可能带着个人信息，所以公开发布时不要直接推旧历史，
而要用一条干净的初始提交开线：

```bash
# 1) 确认当前工作区就是要发布的内容，且 npm run check 全绿
# 2) 另开一条没有父提交的分支
git checkout --orphan main

# 3) 内部材料已经被 .gitignore 忽略，但索引里可能还留着，显式摘掉
git rm -r --cached docs/internal

# 4) 一次提交，就是公开仓库的全部历史
git add -A
git commit -m "public release: v2.2.0"

# 5) 建远端仓库并推送
gh repo create ai-test-stack --public --source=. --remote=origin
git push -u origin main
```

**这个仓库就是这么开的**：公开历史从 `public release: v2.2.0` 这一条开始。发布后，
原来那条含个人信息的本地分支已经删掉——如果哪天需要回头看，`git reflog` 还能找到它的 tip
（本仓库删除时的 tip 是 `606d4f2`），但**不要把那条分支再 push 出去**。

开线之后，`main` 就是唯一的开发分支：本地提交、CI、Pages 都认它。

---

## 7. 排查表

| 现象 | 多半是 | 怎么办 |
|---|---|---|
| `build.js` exit 1，报某条字段缺失 | 数据写漏了字段 | 看报错里的 `id`，照着同类条目补齐 |
| `build.js` 报夺冠率 >40% | 某款工具分数给得太满，评分表退化成假对比 | 按 `README.md` 的校准记录那样，只改有事实依据的分 |
| `a11y-audit.js` 报浅色主题违规 | 新样式写死了亮色 | 改成 `-t` 结尾的变量；内联 `style` 也要用变量 |
| `verify.js` 某组计数不对 | 数据条目数变了，断言没跟着改 | 数据变了就更新 `scripts/verify.js` 里的期望值，别改数据去凑断言 |
| Pages 部署失败，门禁红 | 提交没本地跑过 | 本地 `npm run check` 修好再推；站点会自动停在上一版 |
| 页面上数字和列表对不上 | 文案里写死了计数 | 把数字改成运行时计算，别手改数字 |
| 下载链接 404 | `exports/` 没发布 | 确认 `scripts/build-site.js` 把 `exports` 拷进了 `_site/` |
| 数据标黄（>30 天） | 到核验周期了 | 打开 `#health` 按待办核，改 `verified` |
| 分享链接没有大图 | `og.png` 没生成 | `npm run og` 看报错；CI 上确认 Playwright 装了。改完记得重发链接（平台会缓存旧卡片） |
| 订阅源里没有刚加的那条 | 只改了 `news.json` 没重建 | `node build.js` 后再 `npm run site`；`feed.xml` 只在构建期生成 |
| 页面还是旧版（改完刷新没变） | Service Worker 命中缓存 | 硬刷新一次；正常发布后缓存名跟着 `meta.lastBuilt` 变，会自动失效 |
| `npm run check` 报 `_site 自检失败` | 发布物缺件或 head 缺 meta | 看报错里的具体项：多半是占位符被误删（`<!--__META__-->` 等） |
| 探活工作流红 | 线上真的挂了，或产物 404 | 看 `gh run view` 的日志；先确认 Pages 最近一次部署是不是失败 |
| 纠错按钮点了没反应 | `window.open` 被拦 | 会退化成「复制纠错模板」并弹提示；本地没有远端仓库时行为就是这样 |

---

## 8. 节奏与约定

| 周期 | 做什么 | 谁 |
|---|---|---|
| 每次推送 | 四道门禁 + 生成发布物 + 自动部署 | 机器（`pages.yml`） |
| 每周一 09:10 | 抓 RSS 与价格指纹 + 重构建 + 有变化才提交 | 机器（`data-refresh.yml`） |
| 每周一 07:20 | 检查 playwright 与 Actions 有没有新版本 | 机器（Dependabot） |
| 每天 06:17 | 探活线上：首页、feed、sitemap、og.png、导出物、404 | 机器（`uptime.yml`） |
| 看到告警时 | 人工核对官网，改 JSON，记 `history` | 人 |
| 每周 1–2 条 | 人工新闻 + 「对测试的影响」 | 人 |
| 每季度 | 复核角色渗透度 / 替代度这类编辑判断 | 人 |
| 每次数据变化 | `data/changelog.json` 记一条 | 人 |

`data/changelog.json` 就是站点的「更新日志」页，用户能看见。**改了什么就写什么，
不要为了好看把「修正了一个错价」写成「优化了数据准确性」。**

版本号在 `package.json` 与 `data/meta.json` 里，两边要一致（当前 `2.2.0`）。
功能成规模就升次版本，纯数据核验不发版。

---

## 9. 这个站明确的边界（别越界去补）

- **不做自动改价**：只手写 + 指纹告警。
- **不做账号与社区**：静态站先服务好单人决策。
- **不做薪资与 JD 采样**：没有可靠公开源，写了就是编。
- **不做团队采购 / 席位计算**：需要真实合同条款与报价，公开渠道不足。
- **报价制产品的区间不是标价**：testRigor / mabl / QA Wolf 的数字只用于预算量级，页面已标注。

这些不是没做完，是**故意不做**。要动它们，先看 `docs/PRODUCT-v6.md` 第 3 节的判断依据。
