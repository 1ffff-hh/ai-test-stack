/* SQLite 数据层。用 Node 自带的 node:sqlite，不引第三方依赖——
   站点的「零依赖」底线在服务端也保留。 */
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(__dirname, 'data.sqlite');

/* 哪些集合进库。其余 JSON 仍然只走构建期，不进后台 */
const COLLECTIONS = {
  tools: { file: 'data/tools.json', label: '工具', shape: 'array' },
  plans: { file: 'data/plans.json', label: '套餐', shape: 'array' },
  bundles: { file: 'data/bundles.json', label: '组合', shape: 'array' }
};

function open() {
  const db = new DatabaseSync(DB_PATH);
  db.exec(`CREATE TABLE IF NOT EXISTS docs (
    collection TEXT NOT NULL,
    id         TEXT NOT NULL,
    json       TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (collection, id)
  )`);
  db.exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)');
  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    email      TEXT UNIQUE NOT NULL,
    name       TEXT NOT NULL,
    pass       TEXT NOT NULL,
    role       TEXT NOT NULL DEFAULT 'user',
    status     TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  return db;
}

/* 用户账户 */
const publicUser = u => u && ({ id: u.id, email: u.email, name: u.name, role: u.role, status: u.status, created_at: u.created_at });

function createUser(db, { email, name, pass, role = 'user' }) {
  const now = new Date().toISOString();
  const r = db.prepare('INSERT INTO users (email, name, pass, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(String(email).toLowerCase(), name || email.split('@')[0], pass, role, 'active', now);
  return publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid));
}
const userByEmail = (db, email) => db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase());
const userById = (db, id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id);
const listUsers = db => db.prepare('SELECT * FROM users ORDER BY id').all().map(publicUser);
function patchUser(db, id, patch) {
  const u = userById(db, id);
  if (!u) return null;
  const role = patch.role === undefined ? u.role : patch.role;
  const status = patch.status === undefined ? u.status : patch.status;
  if (['user', 'admin'].indexOf(role) < 0) throw new Error('角色只能是 user 或 admin');
  if (['active', 'banned'].indexOf(status) < 0) throw new Error('状态只能是 active 或 banned');
  db.prepare('UPDATE users SET role = ?, status = ? WHERE id = ?').run(role, status, id);
  return publicUser(userById(db, id));
}

/* 会话 */
function createSession(db, userId, days = 14) {
  const token = require('crypto').randomBytes(32).toString('base64url');
  const now = new Date();
  const exp = new Date(now.getTime() + days * 864e5).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(token, userId, exp, now.toISOString());
  return { token, expiresAt: exp };
}
function sessionUser(db, token) {
  if (!token) return null;
  const s = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!s) return null;
  if (new Date(s.expires_at) < new Date()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  const u = userById(db, s.user_id);
  return u && u.status === 'active' ? publicUser(u) : null;
}
const dropSession = (db, token) => db.prepare('DELETE FROM sessions WHERE token = ?').run(token);

function isEmpty(db, col) {
  const row = db.prepare('SELECT COUNT(*) AS n FROM docs WHERE collection = ?').get(col);
  return !row || row.n === 0;
}

/* 第一次启动把 data/*.json 灌进库；之后库是唯一真相，不再覆盖 */
function seed(db) {
  const seeded = [];
  for (const [col, cfg] of Object.entries(COLLECTIONS)) {
    if (!isEmpty(db, col)) continue;
    const file = path.join(ROOT, cfg.file);
    if (!fs.existsSync(file)) continue;
    const items = JSON.parse(fs.readFileSync(file, 'utf8'));
    const now = new Date().toISOString();
    const ins = db.prepare('INSERT INTO docs (collection, id, json, updated_at) VALUES (?, ?, ?, ?)');
    items.forEach(it => {
      if (!it.id) return;
      ins.run(col, String(it.id), JSON.stringify(it), now);
    });
    seeded.push(`${cfg.label} ${items.length}`);
  }
  return seeded;
}

function list(db, col) {
  return db.prepare('SELECT id, json, updated_at FROM docs WHERE collection = ? ORDER BY rowid').all(col)
    .map(r => ({ ...JSON.parse(r.json), _updatedAt: r.updated_at }));
}

function get(db, col, id) {
  const r = db.prepare('SELECT json, updated_at FROM docs WHERE collection = ? AND id = ?').get(col, id);
  return r ? { ...JSON.parse(r.json), _updatedAt: r.updated_at } : null;
}

function put(db, col, id, obj) {
  const clean = { ...obj };
  delete clean._updatedAt;
  db.prepare('INSERT INTO docs (collection, id, json, updated_at) VALUES (?, ?, ?, ?) ' +
    'ON CONFLICT(collection, id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at')
    .run(col, String(id), JSON.stringify(clean), new Date().toISOString());
  return clean;
}

function remove(db, col, id) {
  const r = db.prepare('DELETE FROM docs WHERE collection = ? AND id = ?').run(col, id);
  return r.changes > 0;
}

/* 库 → data/*.json。导出后仍然由 build.js 走原来的校验，所以后台改坏了数据也过不了构建 */
function exportFiles(db) {
  const out = [];
  for (const [col, cfg] of Object.entries(COLLECTIONS)) {
    const items = list(db, col).map(x => { const y = { ...x }; delete y._updatedAt; return y; });
    const file = path.join(ROOT, cfg.file);
    // 不加结尾换行：原文件就没有，多一个换行会让每次发布都产生一条无意义的 diff
    fs.writeFileSync(file, JSON.stringify(items, null, 1));
    out.push(`${cfg.file} (${items.length})`);
  }
  return out;
}

module.exports = {
  open, seed, list, get, put, remove, exportFiles, COLLECTIONS, DB_PATH,
  publicUser, createUser, userByEmail, userById, listUsers, patchUser,
  createSession, sessionUser, dropSession
};
