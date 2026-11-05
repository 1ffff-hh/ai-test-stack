import { Router } from 'express';
import { z } from 'zod';
import { isCollection, type CollectionKey } from '../../lib/collections.js';
import { badRequest } from '../../lib/errors.js';
import { param } from '../../lib/http.js';
import { requireAdmin } from '../../middleware/auth.js';
import { writeLimiter } from '../../middleware/rateLimit.js';
import { audit } from '../../lib/audit.js';
import * as service from './service.js';

export const contentRouter = Router();

const idSchema = z.string().trim().min(1).max(80);

function collectionOf(raw: string): CollectionKey {
  if (!isCollection(raw)) throw badRequest('没有这个集合');
  return raw;
}

/* 列表。?template=1 返回新建条目的字段模板 */
contentRouter.get('/:collection', async (req, res) => {
  const collection = collectionOf(param(req.params.collection));
  if (req.query.template === '1') {
    res.json({ ok: true, data: { template: await service.blankTemplate(collection) } });
    return;
  }
  res.json({ ok: true, data: { items: await service.list(collection) } });
});

contentRouter.get('/:collection/:id', async (req, res) => {
  const collection = collectionOf(param(req.params.collection));
  const item = await service.get(collection, param(req.params.id));
  if (!item) {
    res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: '没有这一条' } });
    return;
  }
  res.json({ ok: true, data: { item } });
});

contentRouter.post('/:collection', requireAdmin, writeLimiter, async (req, res) => {
  const collection = collectionOf(param(req.params.collection));
  const id = idSchema.parse((req.body as Record<string, unknown>)?.id);
  const item = await service.create(collection, req.body, id);
  await audit({
    userId: req.user!.id,
    action: 'content.create',
    target: `${collection}/${id}`,
    ip: req.ip,
  });
  res.status(201).json({ ok: true, data: { item } });
});

contentRouter.put('/:collection/:id', requireAdmin, writeLimiter, async (req, res) => {
  const collection = collectionOf(param(req.params.collection));
  const id = param(req.params.id);
  const item = await service.update(collection, id, req.body);
  await audit({
    userId: req.user!.id,
    action: 'content.update',
    target: `${collection}/${id}`,
    ip: req.ip,
  });
  res.json({ ok: true, data: { item } });
});

contentRouter.delete('/:collection/:id', requireAdmin, writeLimiter, async (req, res) => {
  const collection = collectionOf(param(req.params.collection));
  const id = param(req.params.id);
  await service.remove(collection, id);
  await audit({
    userId: req.user!.id,
    action: 'content.delete',
    target: `${collection}/${id}`,
    ip: req.ip,
  });
  res.json({ ok: true, data: null });
});
