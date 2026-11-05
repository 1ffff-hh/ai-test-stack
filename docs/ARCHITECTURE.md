# 架构

## 一句话

**内容仍然是静态构建的产物，能力由一套独立的前后端提供。**
静态站不依赖服务端也能跑；启动服务后，多了登录、收藏云同步和可视化后台。

## 现在是什么

```
┌──────────────────┐        ┌───────────────────┐        ┌──────────────────┐
│  前台（公开）      │        │   API :4174        │        │  后台（登录后）    │
│  单文件静态站      │ ─────► │   Express 5 + TS   │ ◄───── │  Vue 3 + Element │
│  /                │  /api  │                    │  /api  │  /admin          │
└──────────────────┘        └─────────┬─────────┘        └──────────────────┘
                                      │ Prisma
                              ┌───────▼────────┐
                              │ SQLite         │
                              │ server/.data/  │
                              └───────┬────────┘
                                      │ 发布时导出
                              ┌───────▼────────┐
                              │ data/*.json    │ → build.js → index.html / _site
                              └────────────────┘
```

两条链路并存，各自独立：

1. **静态链路**（不依赖服务）：`data/*.json` → `build.js` → `index.html` → GitHub Pages。
   `npm run check` 只走这条，CI 和 Pages 都不需要数据库。
2. **动态链路**（本地/自建服务器）：SQLite 是唯一真相 → 服务端渲染首页 + API → 后台增删改。
   点「发布」时才把库导出回 `data/*.json`，再跑一遍静态构建。

## 技术选型

| 层 | 选择 | 理由 |
|---|---|---|
| API | Express 5 + TypeScript | 生态最稳、招人最好招；TS 让接口契约可查 |
| 校验 | zod | 一份 schema 同时做运行时校验和类型推导 |
| ORM | Prisma | schema 即文档，迁移和 Studio 都是现成的 |
| 数据库 | SQLite | 单文件、零运维；换 Postgres 只改 `provider` 和 `DATABASE_URL` |
| 认证 | HttpOnly Cookie + 服务端会话 | 同源站点，cookie 比 JWT 更好撤销；库里只存 token 的 SHA-256 |
| 密码 | scrypt（`node:crypto`） | 抗暴力破解，不引原生依赖，Windows 不会卡 node-gyp |
| 后台 | Vue 3 + Vite + Element Plus + Pinia | 国内后台的主流组合，组件齐全 |
| 日志 | pino | 结构化、低开销 |

## 目录

```
server/
  src/
    env.ts            环境变量（zod 校验，缺省值可用）
    app.ts            Express 组装：安全头 / CORS / Cookie / 路由
    index.ts          启动、灌库、建管理员、优雅退出
    site.ts           首页服务端渲染 + 静态资源挂载
    lib/              prisma / logger / errors / password / audit / collections
    middleware/       auth / validate / error / security / rateLimit / requestLog
    modules/
      auth/           register / login / logout / me / 改密码
      content/        tools · plans · bundles 的 CRUD 与导出
      users/          用户列表、角色、封禁、删除
      favorites/      收藏同步
      system/         health / stats / logs / publish
  prisma/
    schema.prisma     User / Session / Favorite / Document / AuditLog
    seed.ts           把 data/*.json 灌进库
    migrate-legacy.ts 从旧版 server/data.sqlite 迁移
admin/
  src/
    api/              axios 实例 + 统一错误
    stores/           auth / meta（Pinia）
    layouts/          AdminLayout（侧栏 + 顶栏）
    views/            Login / Dashboard / Content / Users / Logs / Settings
```

## 数据模型

| 表 | 作用 | 关键约束 |
|---|---|---|
| `User` | 账号 | `email` 唯一；`role` = USER / ADMIN；`status` = ACTIVE / BANNED |
| `Session` | 登录会话 | `tokenHash` 唯一；过期自动清理；单用户最多 10 个 |
| `Favorite` | 收藏 | `(userId, kind, refId)` 唯一 |
| `Document` | 内容条目 | `(collection, key)` 唯一；`data` 存原始 JSON |
| `AuditLog` | 操作日志 | 谁、什么时候、对什么、做了什么 |

`Document.data` 直接存 JSON 原文，是为了让「库 → data/*.json」的导出保持字节级一致，
静态构建脚本完全不需要知道数据库的存在。

## API

统一前缀 `/api/v1`，统一响应：

```json
{ "ok": true,  "data": { ... } }
{ "ok": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] } }
```

| 方法 | 路径 | 权限 |
|---|---|---|
| POST | `/auth/register` | 公开（限流 20 次 / 15 分钟） |
| POST | `/auth/login` | 公开（同上） |
| POST | `/auth/logout` | 登录 |
| GET | `/auth/me` | 公开（未登录返回 `user: null`） |
| PATCH | `/auth/me` | 登录 |
| GET | `/content/:collection` | 公开 |
| GET | `/content/:collection/:id` | 公开 |
| POST/PUT/DELETE | `/content/:collection[/:id]` | 管理员 |
| GET | `/favorites` | 登录 |
| POST/DELETE | `/favorites[/:kind/:refId]` | 登录 |
| GET | `/users` | 管理员 |
| PATCH/DELETE | `/users/:id` | 管理员 |
| GET | `/system/health` | 公开 |
| GET | `/system/stats` · `/system/logs` | 管理员 |
| POST | `/system/publish` | 管理员 |

## 安全

- 密码哈希用 scrypt（N=16384, r=8, p=1），参数写进哈希串，以后调参不影响老账号。
- 会话 token 32 字节随机，库里只存 SHA-256；Cookie 为 HttpOnly + SameSite=Lax，生产环境加 Secure。
- 写操作校验 `Origin`，只接受同源或 `SITE_ORIGIN`。
- 登录 / 注册限流；所有写接口每分钟 60 次。
- 所有输入过 zod；错误统一出口，500 不泄露堆栈。
- 管理员不能降级或停用自己；至少保留一个可用管理员。
- 停用账号会立刻让该用户所有会话失效。

## 发布

```
库 → data/*.json → build.js（校验） → index.html + _site
```

发布前给 `data/*.json` 拍快照，构建失败原样回滚。
日常改内容**不需要发布**——首页是服务端按库渲染的，刷新即生效；
发布只影响静态托管的那份（GitHub Pages / CDN）。

## 下一步

| 优先级 | 事项 |
|---|---|
| P1 | 部署：云服务器 + 域名 + HTTPS（Caddy 自动证书）+ systemd 守护 + 每日备份 |
| P2 | 纠错提交：前台用户提价格纠错 → 后台审核队列 |
| P3 | 资讯流：`posts` 集合 + 前台列表页 |
| P4 | 可观测性：请求日志落文件、错误上报 |

## 不做的事

- 不做多租户、不做权限矩阵。角色只有 USER / ADMIN 两种。
- 不引入 Redis、消息队列、微服务。单进程 + SQLite 撑到十万级数据没问题。
- 不把前台改写成 SPA。内容站的 SEO 和首屏比交互重要，静态渲染是对的。
