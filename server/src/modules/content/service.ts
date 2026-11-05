import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../../lib/prisma.js';
import { repoRoot } from '../../env.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { COLLECTIONS, type CollectionKey } from '../../lib/collections.js';

export type ContentItem = Record<string, unknown> & { id: string; _updatedAt?: string };

function decode(row: { key: string; data: string; updatedAt: Date }): ContentItem {
  const obj = JSON.parse(row.data) as Record<string, unknown>;
  return { ...obj, id: row.key, _updatedAt: row.updatedAt.toISOString() } as ContentItem;
}

export async function list(collection: CollectionKey): Promise<ContentItem[]> {
  const rows = await prisma.document.findMany({
    where: { collection },
    orderBy: { id: 'asc' },
  });
  return rows.map(decode);
}

export async function get(collection: CollectionKey, key: string): Promise<ContentItem | null> {
  const row = await prisma.document.findUnique({
    where: { collection_key: { collection, key } },
  });
  return row ? decode(row) : null;
}

function normalize(input: unknown, key: string): string {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw badRequest('条目必须是一个对象');
  }
  const obj = { ...(input as Record<string, unknown>) };
  delete obj._updatedAt;
  delete obj.id;

  if (typeof obj.name !== 'string' || !obj.name.trim()) {
    throw badRequest('name 不能为空——构建期会把它当成缺字段拦下来');
  }
  return JSON.stringify({ id: key, ...obj });
}

export async function create(collection: CollectionKey, input: unknown, key: string) {
  if (!/^[a-zA-Z0-9._-]{1,80}$/.test(key)) {
    throw badRequest('id 只能用字母、数字、点、下划线、短横线，最长 80 位');
  }
  const exists = await prisma.document.findUnique({
    where: { collection_key: { collection, key } },
  });
  if (exists) throw conflict('id 已存在');

  const row = await prisma.document.create({
    data: { collection, key, data: normalize(input, key) },
  });
  return decode(row);
}

export async function update(collection: CollectionKey, key: string, input: unknown) {
  const exists = await prisma.document.findUnique({
    where: { collection_key: { collection, key } },
  });
  if (!exists) throw notFound('没有这一条');

  const row = await prisma.document.update({
    where: { collection_key: { collection, key } },
    data: { data: normalize(input, key) },
  });
  return decode(row);
}

export async function remove(collection: CollectionKey, key: string) {
  const r = await prisma.document.deleteMany({ where: { collection, key } });
  if (r.count === 0) throw notFound('没有这一条');
}

/** 新建时的字段模板：照着同集合的第一条生成空壳，避免用户只填 id 就存 */
export async function blankTemplate(collection: CollectionKey) {
  const sample = await prisma.document.findFirst({ where: { collection }, orderBy: { id: 'asc' } });
  const base = sample ? (JSON.parse(sample.data) as Record<string, unknown>) : { id: '', name: '' };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(base)) {
    if (k === 'id' || k === '_updatedAt') continue;
    if (Array.isArray(v)) out[k] = [];
    else if (typeof v === 'number') out[k] = 0;
    else if (typeof v === 'boolean') out[k] = false;
    else if (v && typeof v === 'object') out[k] = {};
    else out[k] = '';
  }
  out.id = '';
  return out;
}

/** 库 → data/*.json。不写结尾换行，保持和原文件字节一致，避免无意义 diff。 */
export async function exportFiles() {
  const out: string[] = [];
  for (const [collection, cfg] of Object.entries(COLLECTIONS) as [CollectionKey, (typeof COLLECTIONS)[CollectionKey]][]) {
    const items = await list(collection);
    const clean = items.map((x) => {
      const y = { ...x };
      delete y._updatedAt;
      return y;
    });
    fs.writeFileSync(path.join(repoRoot, cfg.file), JSON.stringify(clean, null, 1));
    out.push(`${cfg.file} (${clean.length})`);
  }
  return out;
}

/** 首次启动把 data/*.json 灌进库；之后库是唯一真相 */
export async function seedFromFiles(): Promise<string[]> {
  const seeded: string[] = [];
  for (const [collection, cfg] of Object.entries(COLLECTIONS) as [CollectionKey, (typeof COLLECTIONS)[CollectionKey]][]) {
    const count = await prisma.document.count({ where: { collection } });
    if (count > 0) continue;

    const file = path.join(repoRoot, cfg.file);
    if (!fs.existsSync(file)) continue;

    const items = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>[];
    for (const item of items) {
      if (!item.id) continue;
      await prisma.document.create({
        data: {
          collection,
          key: String(item.id),
          data: JSON.stringify(item),
        },
      });
    }
    seeded.push(`${cfg.label} ${items.length}`);
  }
  return seeded;
}
