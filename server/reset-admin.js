/* 重设管理员密码并打印。用法：npm run admin:reset [邮箱] */
const crypto = require('crypto');
const dbm = require('./db');

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
}

const db = dbm.open();
const email = (process.argv[2] || process.env.ADMIN_EMAIL || 'admin@localhost').toLowerCase();
const pass = process.env.ADMIN_PASS || crypto.randomBytes(9).toString('base64url');

const row = dbm.userByEmail(db, email);
if (row) {
  db.prepare('UPDATE users SET pass = ?, role = ?, status = ? WHERE id = ?')
    .run(hashPassword(pass), 'admin', 'active', row.id);
} else {
  dbm.createUser(db, { email, name: '管理员', pass: hashPassword(pass), role: 'admin' });
}

console.log(`管理员 ${email}`);
console.log(`新密码 ${pass}`);
console.log('登录后可以改，或再跑一次这个命令重设。');
