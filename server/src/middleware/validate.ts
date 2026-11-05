import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';

/* Express 5 里 req.query 是只读 getter，所以校验结果统一放到 res.locals.valid，
   处理函数从那里取，不要直接改 req。 */
export function validateBody(schema: ZodTypeAny): RequestHandler {
  return (req, res, next) => {
    const r = schema.safeParse(req.body);
    if (!r.success) {
      return next(
        Object.assign(new Error('请求参数不合法'), {
          status: 400,
          code: 'VALIDATION_ERROR',
          details: r.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        }),
      );
    }
    req.body = r.data;
    res.locals.valid = r.data;
    next();
  };
}

export function validateQuery(schema: ZodTypeAny): RequestHandler {
  return (req, res, next) => {
    const r = schema.safeParse(req.query);
    if (!r.success) {
      return next(
        Object.assign(new Error('查询参数不合法'), {
          status: 400,
          code: 'VALIDATION_ERROR',
          details: r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        }),
      );
    }
    res.locals.query = r.data;
    next();
  };
}
