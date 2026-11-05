import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';
import { prisma } from '../lib/prisma.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { toPublicUser } from '../types.js';

export const SESSION_COOKIE = 'ats_sid';

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/* 每个请求都尝试解析会话，但解析不出来不算错——前台大部分页面是公开的。 */
export const attachUser: RequestHandler = async (req, _res, next) => {
  try {
    const token = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
    if (!token) return next();

    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    if (!session) return next();

    if (session.expiresAt.getTime() <= Date.now()) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      return next();
    }
    if (session.user.status !== 'ACTIVE') return next();

    req.user = toPublicUser(session.user);
    req.sessionId = session.id;
    next();
  } catch (e) {
    next(e);
  }
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  next();
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== 'ADMIN') return next(forbidden('需要管理员权限'));
  next();
};
