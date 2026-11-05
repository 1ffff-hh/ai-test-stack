import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { isProd } from '../env.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    ok: false,
    error: { code: 'NOT_FOUND', message: `没有这个接口：${req.method} ${req.path}` },
  });
};

/* 统一出口：业务错误按自己的状态码返回，其余一律 500 且不泄露堆栈。 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (res.headersSent) return;

  if (err instanceof ZodError) {
    res.status(400).json({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '请求参数不合法',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }

  const status = typeof err?.status === 'number' ? err.status : 500;
  const code = err?.code || (err instanceof AppError ? err.code : 'INTERNAL_ERROR');
  const message = status >= 500 ? '服务器内部错误' : err?.message || '请求失败';

  if (status >= 500) {
    logger.error({ err, method: req.method, path: req.path }, '未处理的错误');
  }

  res.status(status).json({
    ok: false,
    error: {
      code,
      message,
      ...(err?.details ? { details: err.details } : {}),
      ...(isProd || status < 500 ? {} : { stack: String(err?.stack || '').split('\n').slice(0, 6) }),
    },
  });
};
