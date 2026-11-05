/* 业务错误。所有 throw 出来的东西最终都由 middleware/error.ts 转成统一响应，
   前端只需要认一种格式：{ ok: false, error: { code, message, details } } */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = '请先登录') => new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = '没有权限') => new AppError(403, 'FORBIDDEN', message);
export const notFound = (message = '没有找到') => new AppError(404, 'NOT_FOUND', message);
export const conflict = (message: string) => new AppError(409, 'CONFLICT', message);
export const tooMany = (message = '操作太频繁，稍后再试') => new AppError(429, 'TOO_MANY_REQUESTS', message);
