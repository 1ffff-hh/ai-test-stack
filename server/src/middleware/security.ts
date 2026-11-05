import type { RequestHandler } from 'express';
import { env, isProd } from '../env.js';

/* SameSite=Lax 已经挡住绝大多数跨站表单提交，这里再按 Origin 兜一层：
   写操作只接受同源或显式配置的 SITE_ORIGIN。 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/* Vite 开发服务器走代理时 Origin 仍然是 5173，开发环境放行本机几个端口 */
export const DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

export const originGuard: RequestHandler = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get('origin');
  if (!origin) return next(); // 同源的 fetch 在部分场景不带 Origin，交给 SameSite 处理

  const host = req.get('host');
  const sameOrigin = host && (origin === `http://${host}` || origin === `https://${host}`);
  const allowed = env.SITE_ORIGIN && origin === env.SITE_ORIGIN;
  const dev = !isProd && DEV_ORIGINS.includes(origin);

  if (sameOrigin || allowed || dev) return next();

  res.status(403).json({
    ok: false,
    error: { code: 'ORIGIN_REJECTED', message: '跨站请求被拒绝' },
  });
};
