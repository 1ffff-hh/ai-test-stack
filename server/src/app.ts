import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env, isProd } from './env.js';
import { requestLog } from './middleware/requestLog.js';
import { attachUser } from './middleware/auth.js';
import { originGuard, DEV_ORIGINS } from './middleware/security.js';
import { errorHandler } from './middleware/error.js';
import { authRouter } from './modules/auth/router.js';
import { contentRouter } from './modules/content/router.js';
import { usersRouter } from './modules/users/router.js';
import { favoritesRouter } from './modules/favorites/router.js';
import { systemRouter } from './modules/system/router.js';
import { mountSite } from './site.js';

const ADMIN_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
].join('; ');

export function createApp() {
  const app = express();

  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');

  app.use(requestLog);

  // 前台是单文件站，内联脚本和样式很多，全局不开 CSP；后台单独下发
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

  const allowedOrigins = [env.SITE_ORIGIN, ...(isProd ? [] : DEV_ORIGINS)].filter(
    (x): x is string => !!x,
  );
  app.use(
    '/api',
    cors({
      origin: allowedOrigins.length ? allowedOrigins : false,
      credentials: true,
    }),
  );

  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: false, limit: '256kb' }));

  app.use('/api', originGuard);
  app.use('/api', attachUser);

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/content', contentRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/favorites', favoritesRouter);
  app.use('/api/v1/system', systemRouter);

  app.use('/api', (req, res) => {
    res.status(404).json({
      ok: false,
      error: { code: 'NOT_FOUND', message: `没有这个接口：${req.method} ${req.originalUrl}` },
    });
  });

  app.use('/admin', (_req, res, next) => {
    res.setHeader('Content-Security-Policy', ADMIN_CSP);
    next();
  });

  mountSite(app);

  app.use(errorHandler);
  return app;
}
