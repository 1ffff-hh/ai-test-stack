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
src/*            ← 模板。index.html 骨架 + 8 层 CSS + app.js 渲染逻辑
build.js         ← 构建。读 data、校验、把 CSS+数据+JS 内联进根目录 index.html
```

改动的辐射范围：

| 你改了什么 | 要做什么 | 会不会影响别的页面 |
|---|---|---|
| `data/plans.json` 的某个价格 | 改 `price`、`verified` → `node build.js` | 会自动反映到套餐页、组合页、诊断报告、导出文件 |
| 加一款工具 | `data/tools.json` 追加 → 见 `README.md` 的必填字段表 | 工具库、矩阵、PK、诊断、导出全都会多一条 |
| 加一条新闻 | `data/news.json` 追加，**必须写「对测试的影响」** | 只影响 AI 大事页 |
| 改样式 | 组件层动 `src/v8.css`，可读性/状态类动 `src/v9.css` → `node build.js` | 全站，必须重跑对比度审计与第 29 组 |
| 加一个功能页 | `data/modules.json` 挂到某个模块 + `src/app.js` 注册视图 + `build.js` 的 `FEATURE_VIEW_IDS` | 导航、地图、404 页、验收断言都要同步 |
| 加一个站务页 | `data/pages.json` 写文案 + `src/index.html` 加一个 `<section class="view">` + `build.js` 的 `SITE_PAGE_IDS` + `data/nav.json` 挂到某处导航 | 不挂导航**构建会直接失败**（防止「只能靠猜地址」）；`scripts/a11y-audit.js` 与 `scripts/verify.js` 的视图清单也要跟着加 |
| 改导航 | 只改 `data/nav.json` | 顶栏 / 页脚 / 移动端三处一起变；指向不存在的页面会在构建期报错 |

**数字不要写死在文案里。** 模板里凡是「29 款工具」这类数字都应当来自数据；历史上的
「33 条免费额度」文案错了一轮，就是因为写死了。

---

## 3. 日常更新（四种场景，照着做）

### 3.1 核一条价格（最高频）

```bash
# 1) 打开官网定价页确认当前价格
# 2) 一条命令改完 price / history / verified（先加 --dry 看会改什么）
npm run data:set -- kimi_pro 199 "官网会员档调整"
# 3) 重建
node build.js
# 4) 四道门禁
npm run check
# 5) 提交
git add data/ index.html exports/
git commit -m "data: Kimi Pro 168 → 199（2026-11-03 核验）"
```

`data:set` 会替你算好人民币等值（USD × 7.25）、追加 `history` 条目、
同步 `historyPoints` / `priceChanges` / `hasTrend`，并把 `verified` 改成今天。
手写这五处很容易漏，所以别手工改价格。

改完 `quota`、`pros`、`cons` 这类文字仍然要人工写——机器不该替你下编辑判断。

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
- 样式：组件层动 `src/v8.css`，地板与状态动 `src/v9.css`。规矩两条——
  ① 写 `color` 用 `-t` 结尾或 `--cN` 变量，写 `background` / `border` / `gradient` 用不带后缀的主色，
  违反就会在浅色主题下糊成一片，`a11y-audit.js` 会拦下来（渐变文字按每个色标算）；
  ② 任何可见文字不低于 11px，选中态只用 `--sel-*` 这一套配方，`verify.js` 第 29 组会拦退化。

---

## 4. 数据会不会过期，谁来说

三层可靠性依次下降，所以分开报告——这比「一个总成功率」有用：

| 层 | 检查什么 | 可靠性 | 会不会自动改数 |
|---|---|---|---|
| L1 新鲜度 | 每个数据集最后核验日、距今天数、是否 >30 天 | 100% | 否 |
| L2 新闻 RSS | 12 个源，去重 + 标题过滤 + 标题党过滤 | 高 | 只写 `news-auto.json` |
| L3 价格指纹 | 29 个定价页的文本哈希与价格串快照 | 尽力而为 | **只告警，不改价** |
| L4 价格解析 | 锚点 + 正则把价格抽出来，与 `plans.json` 逐档比对 | 中（页面改版即失效，失效会报错） | **只比对，不改价** |

跑一次：

```bash
npm run refresh            # 抓 RSS + 价格指纹，写盘
npm run refresh:dry        # 只看差异
npm run refresh:offline    # 不联网，只做新鲜度报告
npm run data:parse         # 按规则解析官网价格，与库内逐档比对
npm run data:parse:fixtures# 抓取并保存命中窗口（fixture）
npm run data:parse:test    # 离线跑 fixture，验证规则没坏
npm run data:triage        # 列出待处置：页面变了 / 价格变成多少
```

L4 的规则写在 `data/pricing-sources.json`：锚点定位到那一行，窗口内取数。
分不清的**不猜**——CodeBuddy 旗舰版卡片同时有推广价 700、标准价 999、划线价 1399，
这种就不给规则，留人工；火山文档站是 SPA，抓不到价格表，标 `manual`。

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
| `exports/*` | 9 个可下载数据集（含 `plans-history.*`、`community.json`） | `build.js` | 下载链接 404 |
| `feed.xml` | Atom 订阅 | `scripts/build-feed.js` | 订阅者永远收不到更新 |
| `t/*.html` | 每款工具一个独立页面（29 个）+ 工具索引 | `scripts/build-seo-pages.js` | 长尾搜索词没有落地页，只能靠首页一个地址 |
| `p/*.html` | 每档套餐一个独立页面（59 个）+ 套餐索引 | `scripts/build-seo-pages.js` | 同上；「Kimi 会员多少钱」这类搜索搜不到本站 |
| `c/*.html` | 每个社区资源一个独立页面（35 个）+ 资源索引 | `scripts/build-seo-pages.js` | 「Playwright MCP 怎么用」这类搜索搜不到本站 |
| `sitemap.xml` | 站点地图，含全部 127 个地址 | `scripts/build-site.js` | 搜索收录变慢（不致命） |
| `og.png` | 分享卡片大图 | `scripts/build-og.js` | 分享出去没有图，卡片退化成小卡 |
| `sw.js` | 离线缓存 | `scripts/build-site.js` | 只有 `file://` 能离线，网页版不行 |
| `llms.txt` | 给 AI 代理的站点说明书（含 `exports/` 清单） | `scripts/build-site.js` | 代理与 IDE 插件引用不到本站；数字随 data 重建，不会写死 |
| `404.html` | 未知路径兜底 | `scripts/build-site.js` | Pages 用默认 404，用户看到死路 |

`build-site.js` 会自检：产物缺一个、`index.html` 里缺 `canonical` / `og:image` / JSON-LD、
或找不到指向仓库的纠错入口，都直接 `exit 1`。**`npm run check` 的最后一步就是它**，
所以门禁绿 = 发布物齐。

**长尾静态页（`t/` / `p/` / `c/`）是给搜索引擎看的。** 整站是单页应用，所有内容挂在
`#hash` 后面，搜索引擎只认一个地址——站里明明写着「Kimi 会员 ¥199」，但搜这个词
找不到本站。`scripts/build-seo-pages.js` 用 `data/*.json` 生成 124 个独立页面，
每页有自己的标题、描述、canonical，以及 `Product` / `SoftwareApplication` 结构化数据。

- 改页面模板或标题写法：只动 `scripts/build-seo-pages.js`
- 改价格、额度、优缺点：仍然只动 `data/*.json`，重新构建即同步
- **不要手改 `_site/t/`、`_site/p/`、`_site/c/` 里的文件**，它们是产物，每次构建都会重建
- 加一款工具或一档套餐：什么都不用做，下次构建自动多两个页面、站点地图自动多两条

**社区资源库（`c/`）的数据分两份，别改错文件。**

| 文件 | 谁写 | 内容 | 会被 CI 覆盖吗 |
|---|---|---|---|
| `data/community.json` | 人 | 名称、分类、是什么、测试怎么用、坑、适配哪些工具 | **不会** |
| `data/community-stats.json` | 脚本 | 星数、最近提交、许可证、是否归档 | 会（每周） |

- 加一条资源：在 `community.json` 的 `items` 里加一项，然后跑
  `npm run community` 抓它的统计。**不跑的话构建会失败**——这是有意的，
  一张星数为 0 的卡比没有这张卡更伤可信度。
- 只刷新星数：`npm run community`。单个仓库抓失败会保留上一次的值，
  整轮全失败才不写文件（避免把 35 个星数一起清零）。
- 下架一条资源：从 `items` 里删掉，`community-stats.json` 里的旧记录可以留着，不影响构建。
- **不要手改 `community-stats.json`**，下次刷新会被覆盖；要改判断就改 `community.json`。

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

### 5.5 换域名

一条命令，不用改代码：

```bash
npm run domain -- aiteststack.com     # 写入 CNAME，并打印该加的 DNS 记录
npm run domain -- --check             # DNS 生效后，真的去查解析和 HTTPS
npm run domain -- --off               # 退回 github.io 地址
```

绑上之后 `canonical`、`sitemap.xml`、`feed.xml`、`llms.txt`、发布目录里的 `CNAME`
全部自动跟着变——站点地址只有一个来源：`scripts/site-base.js`。
**不要在任何地方手写站点地址**，写死的那天就是换域名漏改的那天。

DNS 记录（在买域名的那个后台加）：

| 类型 | 主机 | 值 |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `<用户名>.github.io` |

加完回仓库 Settings → Pages 填一次 Custom domain，等它显示 DNS check successful，
再勾上 Enforce HTTPS。旧地址 `<用户名>.github.io/<仓库>/` 会自动跳转到新域名，
不用自己做重定向。

> 为什么要换：`<用户名>.github.io` 在国内经常打不开，而且记不住。
> 自定义域名解析到 GitHub Pages 自己的 IP，可达性和「像个正经站」这两件事一起解决。

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
| `npm run data` 报 `page.goto: ERR_CONNECTION_TIMED_OUT`（如 copilot） | 本机 Chromium 连不上该站；**Node 和 git 走的是两条路**——git 配了 `http.proxy`，Chromium/curl 不读它 | 先确认是不是只有本机这样：换 CI 跑一次。要本地跑通就给 Chromium 配代理（`scripts/pw.js` 的 launch 选项），或在能直连的网络下跑。别把这类失败当成规则坏了去改规则 |
| 某个源报 `anchor-not-found` | 官网改版，锚点或正文没了 | 先手动打开那个页面确认「价格还在不在」：还在 → 改 anchor；不在了 → 把整条改成 `mode: "manual"` 并写清原因，别留一条每周报错的死规则 |
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

版本号在 `package.json` 与 `data/meta.json` 里，两边要一致（当前 `0.9.1`）。
功能成规模就升次版本，纯数据核验不发版。

---

## 9. 这个站明确的边界（别越界去补）

- **不做自动改价**：只手写 + 指纹告警。
- **不做账号与社区**：静态站先服务好单人决策。
- **不做薪资与 JD 采样**：没有可靠公开源，写了就是编。
- **不做团队采购 / 席位计算**：需要真实合同条款与报价，公开渠道不足。
- **报价制产品的区间不是标价**：testRigor / mabl / QA Wolf 的数字只用于预算量级，页面已标注。

这些不是没做完，是**故意不做**。要动它们，先看 `docs/PRODUCT-v6.md` 第 3 节的判断依据。
