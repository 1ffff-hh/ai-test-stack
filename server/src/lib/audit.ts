import { prisma } from './prisma.js';
import { logger } from './logger.js';

/* 写日志不能反过来把业务搞挂：失败只记一条 warn。 */
export async function audit(input: {
  userId?: number | null;
  action: string;
  target?: string;
  detail?: unknown;
  ip?: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        target: input.target ?? null,
        detail: input.detail === undefined ? null : JSON.stringify(input.detail).slice(0, 4000),
        ip: input.ip ?? null,
      },
    });
  } catch (e) {
    logger.warn({ err: e }, '写操作日志失败');
  }
}
