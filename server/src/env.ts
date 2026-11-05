import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

/* 这个文件必须在任何会读 process.env 的模块之前被加载。
   Prisma 在构造 Client 时读 DATABASE_URL，所以 lib/prisma.ts 第一行就 import 这里。 */
const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, '..');
const envFile = path.join(serverRoot, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4174),
  DATABASE_URL: z.string().min(1).default('file:../.data/app.db'),
  ADMIN_USERNAME: z.string().default('admin'),
  ADMIN_EMAIL: z.string().default('admin@localhost'),
  ADMIN_PASS: z.string().optional(),
  SESSION_DAYS: z.coerce.number().int().positive().max(365).default(14),
  SITE_ORIGIN: z.string().url().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('环境变量不合法：');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const serverDir = serverRoot;
export const repoRoot = path.resolve(serverRoot, '..');

/* Prisma 的 SQLite 相对路径是相对 schema.prisma 所在目录解析的，
   目录不存在时它不会自己建，所以在连库之前先建好。 */
if (env.DATABASE_URL.startsWith('file:')) {
  const rel = env.DATABASE_URL.slice('file:'.length);
  const abs = path.resolve(path.join(serverRoot, 'prisma'), rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
}
