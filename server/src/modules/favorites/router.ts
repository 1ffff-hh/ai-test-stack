import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { param } from '../../lib/http.js';

export const favoritesRouter = Router();

favoritesRouter.use(requireAuth);

favoritesRouter.get('/', async (req, res) => {
  const items = await prisma.favorite.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({
    ok: true,
    data: {
      items: items.map((f) => ({
        kind: f.kind,
        id: f.refId,
        name: f.name,
        createdAt: f.createdAt.toISOString(),
      })),
    },
  });
});

const addSchema = z.object({
  kind: z.string().trim().min(1).max(20),
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().max(120).optional(),
});

favoritesRouter.post('/', validateBody(addSchema), async (req, res) => {
  const { kind, id, name } = req.body;
  await prisma.favorite.upsert({
    where: { userId_kind_refId: { userId: req.user!.id, kind, refId: id } },
    create: { userId: req.user!.id, kind, refId: id, name: name ?? null },
    update: { name: name ?? null },
  });
  res.json({ ok: true, data: null });
});

favoritesRouter.delete('/:kind/:refId', async (req, res) => {
  await prisma.favorite.deleteMany({
    where: { userId: req.user!.id, kind: param(req.params.kind), refId: param(req.params.refId) },
  });
  res.json({ ok: true, data: null });
});
