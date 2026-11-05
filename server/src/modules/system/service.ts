import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { prisma } from '../../lib/prisma.js';
import { repoRoot } from '../../env.js';
import { COLLECTIONS, type CollectionKey } from '../../lib/collections.js';
import * as content from '../content/service.js';
import { logger } from '../../lib/logger.js';

const run = promisify(execFile);

export async function health() {
  await prisma.$queryRaw`SELECT 1`;
  return { status: 'ok', time: new Date().toISOString() };
}

export async function stats() {
  const [users, admins, sessions, favorites, logs, ...counts] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.session.count({ where: { expiresAt: { gt: new Date() } } }),
    prisma.favorite.count(),
    prisma.auditLog.count(),
    ...(Object.keys(COLLECTIONS) as CollectionKey[]).map((c) =>
      prisma.document.count({ where: { collection: c } }),
    ),
  ]);

  return {
    users,
    admins,
    sessions,
    favorites,
    logs,
    collections: (Object.keys(COLLECTIONS) as CollectionKey[]).map((key, i) => ({
      key,
      label: COLLECTIONS[key].label,
      count: counts[i] ?? 0,
    })),
  };
}

export async function recentLogs(limit = 20) {
  const rows = await prisma.auditLog.findMany({
    orderBy: { id: 'desc' },
    take: Math.min(limit, 100),
    include: { user: { select: { email: true, name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    target: r.target,
    detail: r.detail,
    ip: r.ip,
    createdAt: r.createdAt.toISOString(),
    user: r.user ? { email: r.user.email, name: r.user.name } : null,
  }));
}

function snapshot(): Record<string, Buffer | null> {
  const snap: Record<string, Buffer | null> = {};
  for (const cfg of Object.values(COLLECTIONS)) {
    const f = path.join(repoRoot, cfg.file);
    snap[f] = fs.existsSync(f) ? fs.readFileSync(f) : null;
  }
  return snap;
}

function restore(snap: Record<string, Buffer | null>) {
  for (const [f, buf] of Object.entries(snap)) {
    if (buf === null) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    } else {
      fs.writeFileSync(f, buf);
    }
  }
}

let publishing = false;

/* 发布 = 导出 + 重建静态站。构建不过就把 data/*.json 原样放回去，
   仓库里不会因为一次误操作变成构建不过的状态。 */
export async function publish() {
  if (publishing) return { ok: false as const, msg: '正在发布中，请稍候' };
  publishing = true;
  const snap = snapshot();

  try {
    const files = await content.exportFiles();
    const build = await run(process.execPath, [path.join(repoRoot, 'build.js')], { cwd: repoRoot });
    await run(process.execPath, [path.join(repoRoot, 'scripts', 'build-site.js')], { cwd: repoRoot });
    return {
      ok: true as const,
      files,
      build: String(build.stdout || '').split('\n').slice(0, 5).join('\n'),
    };
  } catch (e) {
    restore(snap);
    const err = e as { stdout?: string; stderr?: string; message?: string };
    logger.error({ err }, '发布失败，已回滚数据文件');
    return {
      ok: false as const,
      rolledBack: true,
      msg:
        '构建没通过，data/*.json 已回滚，站点没有受影响。\n\n' +
        String(err.stdout || err.stderr || err.message || '').slice(0, 2000),
    };
  } finally {
    publishing = false;
  }
}
