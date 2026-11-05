import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { requireAdmin } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { param } from '../../lib/http.js';
import { audit } from '../../lib/audit.js';
import { toPublicUser } from '../../types.js';

export const usersRouter = Router();

const listQuery = z.object({
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

usersRouter.get('/', requireAdmin, async (req, res) => {
  const { q, page, pageSize } = listQuery.parse(req.query);
  const where = q
    ? { OR: [{ email: { contains: q } }, { name: { contains: q } }] }
    : {};

  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { id: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  res.json({
    ok: true,
    data: {
      items: rows.map(toPublicUser),
      total,
      page,
      pageSize,
    },
  });
});

const patchSchema = z
  .object({
    role: z.enum(['USER', 'ADMIN']).optional(),
    status: z.enum(['ACTIVE', 'BANNED']).optional(),
    name: z.string().trim().min(1).max(30).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: '没有要修改的字段' });

usersRouter.patch('/:id', requireAdmin, validateBody(patchSchema), async (req, res) => {
  const id = Number(param(req.params.id));
  if (!Number.isInteger(id) || id <= 0) throw badRequest('用户 id 不合法');

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw notFound('没有这个用户');

  // 防止管理员把自己锁在门外
  if (id === req.user!.id && (req.body.role === 'USER' || req.body.status === 'BANNED')) {
    throw badRequest('不能降级或停用自己');
  }
  if (target.role === 'ADMIN' && req.body.role === 'USER') {
    const admins = await prisma.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } });
    if (admins <= 1) throw badRequest('至少要保留一个可用管理员');
  }

  const user = await prisma.user.update({ where: { id }, data: req.body });
  await audit({
    userId: req.user!.id,
    action: 'user.update',
    target: user.email,
    detail: req.body,
    ip: req.ip,
  });
  res.json({ ok: true, data: { user: toPublicUser(user) } });
});

usersRouter.delete('/:id', requireAdmin, async (req, res) => {
  const id = Number(param(req.params.id));
  if (!Number.isInteger(id) || id <= 0) throw badRequest('用户 id 不合法');
  if (id === req.user!.id) throw badRequest('不能删除自己');

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw notFound('没有这个用户');

  await prisma.user.delete({ where: { id } });
  await audit({ userId: req.user!.id, action: 'user.delete', target: target.email, ip: req.ip });
  res.json({ ok: true, data: null });
});
