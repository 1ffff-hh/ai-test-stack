/* SQLite 数据层。用 Node 自带的 node:sqlite，不引第三方依赖——
   站点的「零依赖」底线在服务端也保留。 */
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(__dirname, 'data.sqlite');

/* 哪些集合进库。其余 JSON 仍然只走构建期，不进后台。 */
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
  return db;
}

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

/* 库 → data/*.json。导出后仍然由 build.js 走原来的校验，所以后台改坏了数据也过不了构建。 */
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

module.exports = { open, seed, list, get, put, remove, exportFiles, COLLECTIONS, DB_PATH };
