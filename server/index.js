/* 本地全栈服务：动态站 + 内容后台。
   零依赖：node:http + node:sqlite + node:crypto。
   用法：npm run server   → http://localhost:4174/ （站点）  /admin （后台） */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const dbm = require('./db');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT || 4174);
const PASS_FILE = path.join(__dirname, '.admin-pass');
const SITE = path.join(ROOT, '_site');
const DIR = fs.existsSync(path.join(SITE, 'index.html')) ? SITE : ROOT;

/* ---------- 口令 ---------- */
function adminPass() {
  if (process.env.ADMIN_PASS) return process.env.ADMIN_PASS;
  if (fs.existsSync(PASS_FILE)) return fs.readFileSync(PASS_FILE, 'utf8').trim();
  const p = crypto.randomBytes(9).toString('base64url');
  fs.writeFileSync(PASS_FILE, p + '\n', { mode: 0o600 });
  return p;
}
const PASS = adminPass();
const sessions = new Set();

const db = dbm.open();
const seeded = dbm.seed(db);

/* ---------- 工具 ---------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };

function send(res, code, body, headers) {
  res.writeHead(code, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, headers || {}));
  res.end(body);
}
function json(res, code, obj, headers) {
  send(res, code, JSON.stringify(obj),
    Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, headers || {}));
}
function cookies(req) {
  const raw = req.headers.cookie || '';
  const out = {};
  raw.split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = p.slice(i + 1).trim(); });
  return out;
}
const authed = req => sessions.has(cookies(req).ats_admin);
function body(req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', c => { buf += c; if (buf.length > 2e6) req.destroy(); });
    req.on('end', () => { try { resolve(buf ? JSON.parse(buf) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

/* 发布前先给 data/*.json 拍快照。构建失败就把文件原样放回去——
   后台允许存半成品，但仓库里的数据不能因为一次误操作就变成构建不过的状态。 */
function snapshot() {
  const snap = {};
  for (const cfg of Object.values(dbm.COLLECTIONS)) {
    const f = path.join(ROOT, cfg.file);
    snap[f] = fs.existsSync(f) ? fs.readFileSync(f) : null;
  }
  return snap;
}
function restore(snap) {
  for (const [f, buf] of Object.entries(snap)) {
    if (buf === null) { if (fs.existsSync(f)) fs.unlinkSync(f); }
    else fs.writeFileSync(f, buf);
  }
}

let publishing = false;
function publish() {
  if (publishing) return { ok: false, msg: '正在发布中' };
  publishing = true;
  const snap = snapshot();
  try {
    const files = dbm.exportFiles(db);
    const out = execFileSync(process.execPath, [path.join(ROOT, 'build.js')], { cwd: ROOT, encoding: 'utf8' });
    // 静态版（含 /t/ /p/ /c/ 那些长尾页）也要跟着重建，否则本地服务端还在发旧 _site
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build-site.js')], { cwd: ROOT, encoding: 'utf8' });
    return { ok: true, files, build: out.split('\n').slice(0, 3).join('\n') };
  } catch (e) {
    restore(snap);
    return {
      ok: false,
      rolledBack: true,
      msg: '构建没通过，data/*.json 已回滚，站点没有受影响。\n\n' + String(e.stdout || e.message).slice(0, 1200)
    };
  } finally {
    publishing = false;
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = decodeURIComponent(url.pathname);

  /* ---------- 后台页面 ---------- */
  if (p === '/admin' || p === '/admin/') {
    const file = path.join(__dirname, 'admin.html');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(file));
  }

  /* ---------- 登录 ---------- */
  if (p === '/api/login' && req.method === 'POST') {
    const b = await body(req).catch(() => ({}));
    if (String(b.password || '') !== PASS) return json(res, 401, { ok: false, msg: '口令不对' });
    const token = crypto.randomBytes(24).toString('base64url');
    sessions.add(token);
    return json(res, 200, { ok: true }, { 'Set-Cookie': `ats_admin=${token}; HttpOnly; SameSite=Lax; Path=/` });
  }
  if (p === '/api/logout' && req.method === 'POST') {
    sessions.delete(cookies(req).ats_admin);
    return json(res, 200, { ok: true }, { 'Set-Cookie': 'ats_admin=; Max-Age=0; Path=/' });
  }
  if (p === '/api/me') return json(res, 200, { ok: authed(req) });

  /* ---------- 后台 API ---------- */
  if (p.startsWith('/api/') && !authed(req)) return json(res, 401, { ok: false, msg: '请先登录' });

  if (p === '/api/collections') {
    const list = Object.entries(dbm.COLLECTIONS).map(([k, c]) => ({
      key: k, label: c.label, count: dbm.list(db, k).length
    }));
    return json(res, 200, { ok: true, collections: list });
  }

  const m = p.match(/^\/api\/c\/([a-z]+)(?:\/(.+))?$/);
  if (m) {
    const col = m[1];
    if (!dbm.COLLECTIONS[col]) return json(res, 404, { ok: false, msg: '没有这个集合' });
    const id = m[2] ? decodeURIComponent(m[2]) : null;
    try {
      if (req.method === 'GET' && !id) return json(res, 200, { ok: true, items: dbm.list(db, col) });
      if (req.method === 'GET' && id) {
        const it = dbm.get(db, col, id);
        return it ? json(res, 200, { ok: true, item: it }) : json(res, 404, { ok: false, msg: '没有这一条' });
      }
      if (req.method === 'PUT' && id) {
        const b = await body(req);
        dbm.put(db, col, id, b);
        return json(res, 200, { ok: true, item: dbm.get(db, col, id) });
      }
      if (req.method === 'POST' && !id) {
        const b = await body(req);
        if (!b.id) return json(res, 400, { ok: false, msg: '必须填 id' });
        if (dbm.get(db, col, b.id)) return json(res, 409, { ok: false, msg: 'id 已存在' });
        dbm.put(db, col, b.id, b);
        return json(res, 200, { ok: true, item: dbm.get(db, col, b.id) });
      }
      if (req.method === 'DELETE' && id) {
        return json(res, 200, { ok: dbm.remove(db, col, id) });
      }
    } catch (e) {
      return json(res, 400, { ok: false, msg: String(e.message).slice(0, 300) });
    }
    return json(res, 405, { ok: false, msg: '不支持的方法' });
  }

  if (p === '/api/publish' && req.method === 'POST') return json(res, 200, publish());

  /* ---------- 站点静态文件 ---------- */
  let file = path.join(DIR, p === '/' ? 'index.html' : p);
  if (!file.startsWith(DIR)) return send(res, 403, 'forbidden');
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) {
    const nf = path.join(DIR, '404.html');
    if (fs.existsSync(nf)) { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(fs.readFileSync(nf)); }
    return send(res, 404, 'not found');
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(`站点   http://localhost:${PORT}/`);
  console.log(`后台   http://localhost:${PORT}/admin`);
  console.log(`口令   ${PASS}${process.env.ADMIN_PASS ? '（来自 ADMIN_PASS）' : '（写在 server/.admin-pass）'}`);
  if (seeded.length) console.log('首次灌库：' + seeded.join(' · '));
});
