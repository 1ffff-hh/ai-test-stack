import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { env, isProd } from '../../env.js';
import { conflict, forbidden, unauthorized, badRequest } from '../../lib/errors.js';
import { hashPassword, passwordProblem, verifyPassword } from '../../lib/password.js';
import { SESSION_COOKIE, hashToken } from '../../middleware/auth.js';
import { toPublicUser } from '../../types.js';
import type { LoginInput, RegisterInput, UpdateMeInput } from './schema.js';

const SESSION_MS = env.SESSION_DAYS * 24 * 60 * 60 * 1000;
const MAX_SESSIONS_PER_USER = 10;

function cookieOptions(maxAge?: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProd && !!env.SITE_ORIGIN?.startsWith('https://'),
    path: '/',
    ...(maxAge === undefined ? {} : { maxAge }),
  };
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

async function issueSession(req: Request, res: Response, userId: number) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_MS);

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      ip: req.ip ?? null,
      userAgent: (req.get('user-agent') || '').slice(0, 300) || null,
    },
  });

  // 单用户会话上限，防止设备越登越多
  const extra = await prisma.session.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    skip: MAX_SESSIONS_PER_USER,
    select: { id: true },
  });
  if (extra.length) {
    await prisma.session.deleteMany({ where: { id: { in: extra.map((s) => s.id) } } });
  }

  res.cookie(SESSION_COOKIE, token, cookieOptions(SESSION_MS));
  return expiresAt;
}

export async function register(req: Request, res: Response, input: RegisterInput) {
  const problem = passwordProblem(input.password);
  if (problem) throw badRequest(problem);

  const exists = await prisma.user.findUnique({ where: { email: input.email } });
  if (exists) throw conflict('这个邮箱已经注册过');

  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name || input.email.split('@')[0] || '用户',
      password: hashPassword(input.password),
    },
  });

  await issueSession(req, res, user.id);
  return { user: toPublicUser(user) };
}

export async function login(req: Request, res: Response, input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // 邮箱不存在和密码错误返回同一句话，避免被枚举账号
  if (!user || !verifyPassword(input.password, user.password)) {
    throw unauthorized('邮箱或密码不对');
  }
  if (user.status !== 'ACTIVE') throw forbidden('账号已被停用，请联系管理员');

  // 旧格式哈希登录成功后顺手升级
  if (!user.password.startsWith('scrypt$')) {
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashPassword(input.password) },
    });
  }

  await issueSession(req, res, user.id);
  return { user: toPublicUser(user) };
}

export async function logout(req: Request, res: Response) {
  if (req.sessionId) {
    await prisma.session.delete({ where: { id: req.sessionId } }).catch(() => undefined);
  }
  clearSessionCookie(res);
}

export async function updateMe(req: Request, input: UpdateMeInput) {
  const me = req.user!;
  const data: { name?: string; password?: string } = {};

  if (input.name) data.name = input.name;

  if (input.newPassword) {
    const row = await prisma.user.findUnique({ where: { id: me.id } });
    if (!row || !verifyPassword(input.currentPassword || '', row.password)) {
      throw badRequest('当前密码不对');
    }
    const problem = passwordProblem(input.newPassword);
    if (problem) throw badRequest(problem);
    data.password = hashPassword(input.newPassword);
  }

  const user = await prisma.user.update({ where: { id: me.id }, data });

  // 改密码后踢掉其他设备，保留当前会话
  if (data.password) {
    await prisma.session.deleteMany({
      where: { userId: me.id, id: { not: req.sessionId ?? '' } },
    });
  }

  return { user: toPublicUser(user) };
}
