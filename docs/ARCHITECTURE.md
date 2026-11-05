# 架构：从静态站到完整产品

## 现在是什么

一个单文件静态站：`data/*.json` + `src/*` 由 `build.js` 内联成 `index.html`，
零依赖、`file://` 能开、不收集任何信息。8 个内容页，29 款工具 / 59 档套餐 / 32 套组合。

它的价值是「数据可信、结论可交付」，不是「功能多」。所以演进的原则是：
**内容资产不重写，交互能力新建。**

## 要变成什么

前后端分离的完整产品：

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│  前台 web    │ ───► │   API 服务    │ ◄─── │  后台 admin  │
│  (公开访问)   │      │  Express     │      │  (登录后)    │
└─────────────┘      └──────┬───────┘      └─────────────┘
                            │
                     ┌──────▼───────┐
                     │   SQLite     │
                     └──────────────┘
```

- **前台**：现有站点继续用，逐步从「数据内联」改成「启动时拉 `/api/bootstrap`」。
  未登录可读全部内容；登录后多出收藏云同步、纠错提交、订阅。
- **后台**：独立 SPA，登录 + 角色守卫。内容管理、用户管理、审核队列、操作日志。
- **API**：唯一的写入入口。所有校验在服务端做一遍，构建期的校验仍然保留。

## 技术选型

| 层 | 选择 | 理由 |
|---|---|---|
| API | Node 22 + Express 5 | 生态最稳，团队最容易接手 |
| 数据库 | SQLite（`node:sqlite`） | 单文件、零运维；数据量到十万级再换 Postgres |
| 认证 | session cookie + scrypt | 不用 JWT：前台同源，cookie 更简单也更能撤销 |
| 密码 | `node:crypto` scrypt | 不引原生依赖，Windows 上不会卡在 node-gyp |
| 后台 | Vue 3 + Vite | 与 TestHub 技术栈一致 |
| 部署 | 单个 Node 进程 | 同时服务 API 和构建产物；也可以前后端分开 |

## 数据模型

```
users        id, email, name, pass_hash, role(user|admin), status, created_at
sessions     token, user_id, expires_at, ua, ip
docs         collection, id, json, updated_at        -- 内容（工具/套餐/组合/资讯）
posts        id, slug, title, body_md, cover, status(draft|published), author_id, published_at
comments     id, target_type, target_id, user_id, body, status(pending|ok|hidden), created_at
favorites    user_id, kind, ref_id, created_at
audit_log    id, user_id, action, collection, ref_id, before_json, after_json, created_at
```

内容仍以 JSON 存 `docs` 表：字段差异大（工具 30 个字段、套餐 33 个），
拆成关系表会让每次加字段都变成一次迁移。等某个集合稳定了再单独建表。

## API

```
POST   /api/auth/register      {email, password, name}
POST   /api/auth/login         {email, password} → Set-Cookie
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/bootstrap                          前台启动数据（内容 + 计数 + 核验日）
GET    /api/content/:collection                公开列表
GET    /api/content/:collection/:id

GET    /api/admin/collections                  后台：集合与计数
GET    /api/admin/content/:collection          后台：全量（含草稿）
PUT    /api/admin/content/:collection/:id
POST   /api/admin/content/:collection
DELETE /api/admin/content/:collection/:id
POST   /api/admin/publish                      导出 JSON → 构建 → 失败回滚
GET    /api/admin/users                        用户列表（admin）
PATCH  /api/admin/users/:id                    改角色 / 封禁（admin）
GET    /api/admin/audit                        操作日志

POST   /api/favorites                          收藏
DELETE /api/favorites/:kind/:ref
POST   /api/comments                           纠错 / 评论（进审核队列）
```

## 页面

**前台**（现有 8 页保留）：首页诊断、工具、价格、方案、动向、角色、资源、数据。
新增：登录 / 注册、个人中心（收藏、我的提交）。

**后台**：
- 仪表盘：内容计数、待审核评论、最近改动、数据新鲜度
- 内容：集合列表 → 条目编辑（自动生成表单 + JSON 兜底）
- 审核：评论 / 纠错队列
- 用户：列表、改角色、封禁
- 日志：谁在什么时候改了什么，可回看 before/after

## 演进成技术站

现在的 8 页是「工具选型」。要变成技术站，加的是**资讯流**而不是改现有页：

1. `posts` 表上线，后台能写文章（Markdown）
2. 首页顶部加资讯流，工具选型退成其中一个栏目
3. 评论 / 订阅 / 搜索基于 posts 展开

不改数据结构也能做：`posts` 和 `docs` 是并列的两种内容，互不依赖。

## 阶段

| 阶段 | 内容 | 状态 |
|---|---|---|
| P0 | 本地 API + SQLite + 后台 CRUD + 发布回滚 | 已有雏形 |
| P1 | 用户体系：注册/登录/session/角色 + 后台用户管理 | 本次 |
| P2 | 前台接 API：登录态、收藏云同步、纠错提交 | 下一步 |
| P3 | 审核队列 + 操作日志 + 仪表盘 | |
| P4 | posts 资讯流，首页改版 | |
| P5 | 部署：云服务器 + 域名 + HTTPS + 备份 | |

## 不做的事

- 不做实时协作、不做 IM、不做多租户
- 不把内容拆成关系表（字段太散，迁移成本高于收益）
- 不为了「看起来像后台」加没有实际用途的图表
