import fs from 'node:fs';
import path from 'node:path';
import express, { type Express } from 'express';
import { repoRoot, serverDir } from './env.js';
import { COLLECTIONS, type CollectionKey } from './lib/collections.js';
import { list } from './modules/content/service.js';
import { logger } from './lib/logger.js';

const DATA_RE = /\/\*DATA_START\*\/([\s\S]*?)\/\*DATA_END\*\//;

let cache: { mtime: number; raw: string } | null = null;

/* 前台是构建期生成的单文件站。这里把其中写死的数据块换成库里的最新内容，
   后台改完刷新就生效，不用等「发布」——发布只负责静态托管那份。 */
export async function renderSite(): Promise<string> {
  const file = path.join(repoRoot, 'index.html');
  const stat = fs.statSync(file);
  if (!cache || cache.mtime !== stat.mtimeMs) {
    cache = { mtime: stat.mtimeMs, raw: fs.readFileSync(file, 'utf8') };
  }

  const m = cache.raw.match(DATA_RE);
  if (!m) return cache.raw;

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(m[1]!) as Record<string, unknown>;
  } catch {
    return cache.raw;
  }

  for (const key of Object.keys(COLLECTIONS) as CollectionKey[]) {
    data[key] = (await list(key)).map((x) => {
      const y = { ...x };
      delete y._updatedAt;
      return y;
    });
  }

  const payload = '/*DATA_START*/' + JSON.stringify(data) + '/*DATA_END*/';
  return cache.raw.replace(m[0], () => payload);
}

export function mountSite(app: Express) {
  const siteDir = fs.existsSync(path.join(repoRoot, '_site', 'index.html'))
    ? path.join(repoRoot, '_site')
    : repoRoot;
  const adminDist = path.join(serverDir, '..', 'admin', 'dist');

  // 后台 SPA
  if (fs.existsSync(path.join(adminDist, 'index.html'))) {
    app.use('/admin', express.static(adminDist, { index: 'index.html', maxAge: '1h' }));
    app.use('/admin', (_req, res) => {
      res.sendFile(path.join(adminDist, 'index.html'));
    });
  } else {
    app.get(/^\/admin(\/.*)?$/, (_req, res) => {
      res
        .status(503)
        .type('html')
        .send(
          '<meta charset="utf-8"><pre style="font:14px/1.8 monospace;padding:40px">' +
            '后台还没构建。\n\n开发模式：npm run admin  → http://localhost:5173/admin/\n构建：    npm run build:admin\n\n' +
            '</pre>',
        );
    });
  }

  // 首页：按库渲染
  app.get(['/', '/index.html'], async (_req, res, next) => {
    try {
      const html = await renderSite();
      res.set('Cache-Control', 'no-store').type('html').send(html);
    } catch (e) {
      next(e);
    }
  });

  // 其余静态文件（_site 里的长尾页、图片、sitemap 等）
  app.use(
    express.static(siteDir, {
      index: false,
      setHeaders(res, filePath) {
        if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-store');
      },
    }),
  );

  app.use((req, res) => {
    const nf = path.join(siteDir, '404.html');
    if (fs.existsSync(nf)) {
      res.status(404).type('html').send(fs.readFileSync(nf));
      return;
    }
    res.status(404).type('text').send('not found');
  });

  logger.info({ siteDir, adminDist }, '静态资源目录已挂载');
}
