/* 命令行发布：库 → data/*.json → 重建静态站。
   和后台里的「发布到静态站」是同一件事，只是不经过浏览器。 */
const path = require('path');
const { execFileSync } = require('child_process');
const dbm = require('./db');

const db = dbm.open();
dbm.seed(db);
const files = dbm.exportFiles(db);
console.log('已导出：' + files.join(' · '));

const ROOT = path.join(__dirname, '..');
try {
  const out = execFileSync(process.execPath, [path.join(ROOT, 'build.js')], { cwd: ROOT, encoding: 'utf8' });
  console.log(out.split('\n').slice(0, 3).join('\n'));
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build-site.js')], { cwd: ROOT, encoding: 'utf8' });
  console.log('静态版已重建（_site/）');
} catch (e) {
  console.error('构建失败：\n' + String(e.stdout || e.message).slice(0, 1200));
  process.exit(1);
}
