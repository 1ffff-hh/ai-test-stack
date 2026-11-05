import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';

const reject = (message: string): RequestHandler => (_req, res) => {
  res.status(429).json({ ok: false, error: { code: 'TOO_MANY_REQUESTS', message } });
};

/* 登录注册：15 分钟 20 次，够正常人用，挡得住撞库脚本 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: reject('尝试次数太多，请 15 分钟后再试'),
});

/* 写操作：每分钟 60 次 */
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: reject('操作太频繁，请稍后再试'),
});
