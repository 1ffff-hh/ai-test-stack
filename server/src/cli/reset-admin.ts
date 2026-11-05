/* 重设管理员密码并打印。用法：npm run admin:reset [邮箱] */
import { randomBytes } from 'node:crypto';
import { prisma, disconnect } from '../lib/prisma.js';
import { env } from '../env.js';
import { hashPassword } from '../lib/password.js';

const email = (process.argv[2] || env.ADMIN_EMAIL).trim().toLowerCase();
const password = env.ADMIN_PASS || randomBytes(9).toString('base64url');

const existing = await prisma.user.findUnique({ where: { email } });
if (existing) {
  await prisma.user.update({
    where: { email },
    data: { password: hashPassword(password), role: 'ADMIN', status: 'ACTIVE' },
  });
  await prisma.session.deleteMany({ where: { userId: existing.id } });
} else {
  await prisma.user.create({
    data: { email, name: '管理员', password: hashPassword(password), role: 'ADMIN' },
  });
}

console.log(`管理员 ${email}`);
console.log(`新密码 ${password}`);
console.log('该账号的其他登录会话已全部失效。');

await disconnect();
