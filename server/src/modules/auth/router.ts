import { Router } from 'express';
import { validateBody } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { authLimiter, writeLimiter } from '../../middleware/rateLimit.js';
import { audit } from '../../lib/audit.js';
import { loginSchema, registerSchema, updateMeSchema } from './schema.js';
import * as service from './service.js';

export const authRouter = Router();

authRouter.post('/register', authLimiter, validateBody(registerSchema), async (req, res) => {
  const { user } = await service.register(req, res, req.body);
  await audit({ userId: user.id, action: 'auth.register', target: user.username, ip: req.ip });
  res.status(201).json({ ok: true, data: { user } });
});

authRouter.post('/login', authLimiter, validateBody(loginSchema), async (req, res) => {
  const { user } = await service.login(req, res, req.body);
  await audit({ userId: user.id, action: 'auth.login', target: user.username, ip: req.ip });
  res.json({ ok: true, data: { user } });
});

authRouter.post('/logout', async (req, res) => {
  await service.logout(req, res);
  res.json({ ok: true, data: null });
});

authRouter.get('/me', (req, res) => {
  res.json({ ok: true, data: { user: req.user ?? null } });
});

authRouter.patch('/me', requireAuth, writeLimiter, validateBody(updateMeSchema), async (req, res) => {
  const { user } = await service.updateMe(req, req.body);
  await audit({
    userId: user.id,
    action: 'auth.update',
    target: user.username,
    detail: { fields: Object.keys(req.body) },
    ip: req.ip,
  });
  res.json({ ok: true, data: { user } });
});
