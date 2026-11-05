import { Router } from 'express';
import { requireAdmin } from '../../middleware/auth.js';
import { audit } from '../../lib/audit.js';
import * as service from './service.js';

export const systemRouter = Router();

systemRouter.get('/health', async (_req, res) => {
  res.json({ ok: true, data: await service.health() });
});

systemRouter.get('/stats', requireAdmin, async (_req, res) => {
  res.json({ ok: true, data: await service.stats() });
});

systemRouter.get('/logs', requireAdmin, async (req, res) => {
  const limit = Number(req.query.limit || 20);
  res.json({ ok: true, data: { items: await service.recentLogs(Number.isFinite(limit) ? limit : 20) } });
});

systemRouter.post('/publish', requireAdmin, async (req, res) => {
  const result = await service.publish();
  await audit({
    userId: req.user!.id,
    action: result.ok ? 'system.publish' : 'system.publish.failed',
    detail: result.ok ? { files: result.files } : { msg: result.msg },
    ip: req.ip,
  });
  res.status(result.ok ? 200 : 422).json({ ok: result.ok, data: result, ...(result.ok ? {} : { error: { code: 'BUILD_FAILED', message: result.msg } }) });
});
