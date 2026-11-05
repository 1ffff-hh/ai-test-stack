/* 从旧版 server/data.sqlite 迁移用户、收藏和内容条目。
   用法：npm run migrate:legacy --workspace @ats/server
   幂等：已存在的邮箱 / 条目会跳过，不会覆盖新库里的修改。 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { prisma, disconnect } from '../src/lib/prisma.js';
import { serverDir } from '../src/env.js';

const legacyPath = path.join(serverDir, 'data.sqlite');
if (!fs.existsSync(legacyPath)) {
  console.log('没有旧库 server/data.sqlite，跳过');
  process.exit(0);
}

const legacy = new DatabaseSync(legacyPath, { readOnly: true });

type Row = Record<string, unknown>;
const rows = (sql: string): Row[] => legacy.prepare(sql).all() as Row[];

let users = 0;
let docs = 0;
let favs = 0;

for (const u of rows('SELECT * FROM users')) {
  const email = String(u.email).trim().toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) continue;
  await prisma.user.create({
    data: {
      email,
      name: String(u.name || email.split('@')[0]),
      password: String(u.pass),
      role: String(u.role) === 'admin' ? 'ADMIN' : 'USER',
      status: String(u.status) === 'active' ? 'ACTIVE' : 'BANNED',
      createdAt: u.created_at ? new Date(String(u.created_at)) : undefined,
    },
  });
  users++;
}

for (const d of rows('SELECT * FROM docs')) {
  const collection = String(d.collection);
  const key = String(d.id);
  const exists = await prisma.document.findUnique({
    where: { collection_key: { collection, key } },
  });
  if (exists) continue;
  await prisma.document.create({
    data: {
      collection,
      key,
      data: String(d.json),
      updatedAt: d.updated_at ? new Date(String(d.updated_at)) : undefined,
    },
  });
  docs++;
}

const emailById = new Map<number, string>();
for (const u of rows('SELECT id, email FROM users')) emailById.set(Number(u.id), String(u.email));

for (const f of rows('SELECT * FROM favorites')) {
  const email = emailById.get(Number(f.user_id));
  if (!email) continue;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) continue;
  await prisma.favorite.upsert({
    where: {
      userId_kind_refId: { userId: user.id, kind: String(f.kind), refId: String(f.ref_id) },
    },
    create: {
      userId: user.id,
      kind: String(f.kind),
      refId: String(f.ref_id),
      name: f.name ? String(f.name) : null,
    },
    update: {},
  });
  favs++;
}

console.log(`迁移完成：用户 ${users} · 条目 ${docs} · 收藏 ${favs}`);
await disconnect();
