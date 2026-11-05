import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/* scrypt 是 Node 自带的抗暴力破解 KDF，参数固定写进哈希串里，
   以后调参可以直接换，老哈希仍然能验证。 */
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain.normalize('NFKC'), salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  if (!stored) return false;

  // 旧版格式：salt(hex):hash(hex)，迁移过来的账号继续能登录
  if (!stored.startsWith('scrypt$')) {
    const i = stored.indexOf(':');
    if (i < 0) return false;
    const salt = Buffer.from(stored.slice(0, i), 'hex');
    const want = Buffer.from(stored.slice(i + 1), 'hex');
    const got = scryptSync(plain.normalize('NFKC'), salt, want.length);
    return want.length === got.length && timingSafeEqual(want, got);
  }

  const [algo, n, r, p, saltB64, hashB64] = stored.split('$');
  if (algo !== 'scrypt' || !n || !r || !p || !saltB64 || !hashB64) return false;
  const want = Buffer.from(hashB64, 'base64');
  const got = scryptSync(plain.normalize('NFKC'), Buffer.from(saltB64, 'base64'), want.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return want.length === got.length && timingSafeEqual(want, got);
}

/** 密码规则只有长度：至少 5 位，不限制字符种类 */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 5) return '密码至少 5 位';
  if (pw.length > 128) return '密码最长 128 位';
  return null;
}
