import type { RequestHandler } from 'express';
import { logger } from '../lib/logger.js';

/* 只记接口请求：静态资源一个页面几十个，全记会把日志淹掉。 */
export const requestLog: RequestHandler = (req, res, next) => {
  if (!req.originalUrl.startsWith('/api')) return next();

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level](
      {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        ms: Math.round(ms),
        ip: req.ip,
        userId: req.user?.id,
      },
      'request',
    );
  });
  next();
};
