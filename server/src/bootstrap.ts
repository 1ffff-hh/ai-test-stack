import { randomBytes } from 'node:crypto';
import { prisma } from './lib/prisma.js';
import { env } from './env.js';
import { hashPassword } from './lib/password.js';
import { logger } from './lib/logger.js';

/* 库里一个管理员都没有时，建一个并打印初始密码（只打印这一次）。 */
export async function bootstrapAdmin(): Promise<string | null> {
  const admins = await prisma.user.count({ where: { role: 'ADMIN' } });
  if (admins > 0) return null;

  const username = env.ADMIN_USERNAME.trim().toLowerCase();
  const exists = await prisma.user.findUnique({ where: { username } });

  if (exists) {
    await prisma.user.update({ where: { username }, data: { role: 'ADMIN', status: 'ACTIVE' } });
    logger.warn({ username }, '已存在的账号被提升为管理员');
    return null;
  }

  const password = env.ADMIN_PASS || randomBytes(9).toString('base64url');
  await prisma.user.create({
    data: {
      username,
      email: env.ADMIN_EMAIL.trim().toLowerCase(),
      name: '管理员',
      password: hashPassword(password),
      role: 'ADMIN',
    },
  });
  return password;
}
