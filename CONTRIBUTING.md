# 参与贡献

这个项目最需要的不是代码，是**核对过的数据**。所以先看第一条。

## 一、纠一条数据（最有价值的贡献）

需要提供四样东西，缺一样就不会合并：

1. **哪一条**：页面上的条目名，或 `data/*.json` 里的 `id`（例如 `plans.json` 的 `glm`）。
2. **现在的值**：页面上目前显示什么。
3. **正确的值**：应该是什么。
4. **来源链接与核验日期**：官网定价页 / 官方文档的 URL，以及你哪天看的。

直接开 [数据纠错 Issue](https://github.com/1ffff-hh/ai-test-stack/issues/new?template=data-correction.yml)
即可，不用改代码。想自己提 PR 也可以，见下面。

**不接受的**：没有源链接的价格、「听说」「群里说」、把活动价写成常规定价、
把「$20 起」写成「$20」。价格类数据改错比不改更糟。

## 二、本地跑起来

```bash
node build.js          # 重建 index.html（数据有问题会 exit 1）
npm run check          # 四道门禁：数据校验 + 脱敏 + 对比度 + 功能验收
npm run preview        # 生成 _site/ 并用 http 端起来，模拟 Pages 访问
```

`npm run check` 需要 Playwright（`npm install` 会装；本机装了 Chrome 也直接能跑）。
浏览器启动集中在 `scripts/browser.js`，模块路径集中在 `scripts/pw.js`，都支持环境变量覆盖。

## 三、提交前必须过的四道门禁

| 门禁 | 命令 | 拦什么 |
|---|---|---|
| 数据校验 | `node build.js` | 字段缺失、来源等级非法、夺冠率 >40%、过期未下架的优惠 |
| 脱敏扫描 | `node scripts/check-pii.js` | 本机绝对路径、会话 ID、密钥、私人邮箱 |
| 对比度 | `node scripts/a11y-audit.js` | 35 视图 × 深/浅主题，WCAG AA 不达标 |
| 功能验收 | `node scripts/verify.js` | 23 组断言：路由、打印、响应式、各页计数 |

**不要提交本机路径、用户名、聊天会话 ID。** `check-pii.js` 会拦住，被拦住就改写成
占位符（`<仓库路径>`、`<用户名>`），或把那份材料放进 `docs/internal/`（已被 gitignore）。

## 四、改数据的规矩

- **只加有来源的条目**。每条价格都要有 `link` 和 `verified`；核验日改成你看的那天。
- **评分是判断，要标出来**。`provenance` 只能是 `official` / `measured` / `community` / `inferred`，
  别把推断写成官方。
- **不要为了好看改数**。`build.js` 里有蒙特卡洛夺冠率门禁：任何一款工具夺冠率 >40% 直接 exit 1。
  分数调不平就如实调平，不要加噪声凑通过。
- **自动抓取只告警，不改价**。这条边界不要动。
- 数字变了，顺手在 `data/changelog.json` 记一条。

## 五、改界面

样式分六层，顺序不能反：`styles.css → v4.css → v4-responsive.css → v5.css → v6.css → v7.css`。
新增组件一律用变量，不要写新数值（字号档 `--fs-1..8`、圆角 `--r-sm/md/lg`、间距 `--sp-1..7`）。

写 `color` 用 `-t` 结尾的变量或 `--cN`；写 `background` / `border` / `gradient` 用不带后缀的主色。
这条规矩是为了深/浅两套主题都能过对比度审计 —— 违反它，`a11y-audit.js` 会红。

## 六、PR

- 一个 PR 只做一件事（一次数据核验 / 一个功能 / 一处样式）。
- 描述里写清：改了什么、依据是什么、本地跑没跑过 `npm run check`。
- 加了新页面或新数据集的，同时更新 `README.md` 的目录结构与 `docs/` 下的设计或验收文档。
