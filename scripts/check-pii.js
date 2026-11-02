#!/usr/bin/env node
/* 脱敏扫描：发布前拦住本机路径、会话标识、密钥与私人邮箱。
   把要发布的文件全部过一遍；命中任何一条就 exit 1，并打印 文件:行 与规则名。
   用法：node scripts/check-pii.js [--quiet] */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const QUIET = process.argv.includes('--quiet');

// 不扫描的目录（相对仓库根，正斜杠）
const SKIP_DIRS = new Set([
  '.git', 'node_modules', '.shots', '_site', 'dist',
  'docs/internal'          // 内部材料，本来就不发布
]);
// 不扫描的二进制扩展名
const SKIP_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf',
  '.woff', '.woff2', '.ttf', '.eot', '.zip', '.gz', '.mp4'
]);

// 规则：命中即失败
const RULES = [
  { id: 'win-user-path',  desc: 'Windows 用户目录绝对路径',
    re: /[A-Za-z]:[\\/]{1,2}(?:Users|Documents and Settings)[\\/]{1,2}[^\\/\s"')]+/g },
  { id: 'posix-home-path', desc: '类 Unix 家目录绝对路径',
    re: /(?:\/c\/Users|\/home|\/Users)\/[A-Za-z0-9._-]{2,}/g },
  { id: 'abs-desktop',    desc: '本机桌面绝对路径',
    re: /[A-Za-z]:[\\/]{1,2}Desktop[\\/]{1,2}[^\s"')]*/g },
  { id: 'session-id',     desc: '会话 ID（UUID）',
    re: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g },
  { id: 'vs-tool-dir',    desc: '特定 AI 工具的本地配置目录',
    re: /(?:\.zcode|\.workbuddy|\.claude\/projects)[\\/][^\s"')]*/g },
  { id: 'openai-key',     desc: '疑似 OpenAI 密钥', re: /\bsk-[A-Za-z0-9_-]{20,}/g },
  { id: 'github-token',   desc: '疑似 GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{20,}/g },
  { id: 'aws-key',        desc: '疑似 AWS Access Key', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { id: 'google-key',     desc: '疑似 Google API Key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { id: 'slack-token',    desc: '疑似 Slack token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g },
  { id: 'private-key',    desc: '私钥文件内容',
    re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g },
  { id: 'jwt',            desc: '疑似 JWT', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./g }
];

// 允许保留的邮箱域名（公开机构/机器人地址），其余邮箱一律报告
const EMAIL_OK = /@(?:users\.noreply\.github\.com|noreply\.github\.com|noreply\.anthropic\.com|example\.(?:com|org)|localhost)$/i;
const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const rel = path.relative(ROOT, abs).split(path.sep).join('/');
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(rel) || SKIP_DIRS.has(name)) continue;
      walk(abs, out);
    } else {
      if (SKIP_EXT.has(path.extname(name).toLowerCase())) continue;
      if (st.size > 4 * 1024 * 1024) continue;   // 超大文件跳过
      out.push({ abs, rel });
    }
  }
  return out;
}

const mask = s => (s.length <= 12 ? s : s.slice(0, 6) + '…' + s.slice(-2));

/* 自检：每条规则必须先能抓到一条样例，否则这个扫描器等于没开。
   验收脚本自己也要被验收。 */
if (process.argv.includes('--self-test')) {
  // pii-scan:off —— 下面是故意造的假样例，用来验证每条规则抓得到东西
  const FIXTURES = {
    'win-user-path':  'D:\\Users\\somebody\\AppData\\Roaming\\npm',
    'posix-home-path': 'cd /c/Users/somebody/repo && ls',
    'abs-desktop':    '参数：D:\\Desktop\\work\\repo\\scripts\\refresh.js',
    'session-id':     'transcript 8f3a1c2e-4b5d-4e6f-8a9b-0c1d2e3f4a5b.jsonl',
    'vs-tool-dir':    'C:\\Users\\x\\.zcode\\cli\\memories\\memory\\MEMORY.md',
    /* 密钥类样例一律拼出来，不写字面量：一是文件里不该出现能过密钥扫描的字符串
       （GitHub push protection 会把像真密钥的东西拦下来），二是逼着样例明显是假的。 */
    'openai-key':     'sk-' + 'A'.repeat(24),
    'github-token':   'ghp_' + 'B'.repeat(24),
    'aws-key':        'AKIA' + 'C'.repeat(16),
    'google-key':     'AIza' + 'D'.repeat(35),
    'slack-token':    'xoxb-' + '1'.repeat(12),
    'private-key':    '-----BEGIN ' + 'OPENSSH PRIVATE KEY' + '-----',
    'jwt':            'eyJ' + 'E'.repeat(12) + '.' + 'F'.repeat(12) + '.'
  };
  const fails = [];
  for (const r of RULES) {
    const s = FIXTURES[r.id];
    if (!s) { fails.push(r.id + ' 缺少自检样例'); continue; }
    r.re.lastIndex = 0;
    if (!r.re.test(s)) fails.push(r.id + ' 没抓到样例: ' + s);
  }
  // 邮箱允许清单必须放行机器人、拦住私人邮箱
  if (!EMAIL_OK.test('bot@users.noreply.github.com')) fails.push('email 误伤 noreply 地址');
  if (EMAIL_OK.test('someone@qq.com')) fails.push('email 没拦住私人邮箱');
  // pii-scan:on
  const stats = { rules: RULES.length, checked: Object.keys(FIXTURES).length, failed: fails.length, failures: fails };
  console.log(JSON.stringify(stats, null, 2));
  if (fails.length) console.error('\n自检失败：' + fails.join('；'));
  process.exit(fails.length ? 1 : 0);
}

const files = walk(ROOT);
const hits = [];
for (const f of files) {
  const text = fs.readFileSync(f.abs, 'utf8');
  const lines = text.split(/\r?\n/);
  /* 行内标记 pii-scan:off / pii-scan:on 之间的内容跳过。
     只给两种地方用：本文件的自检样例、文档里举例说明红线的那几行。
     真实内容不许用这个标记绕过去。 */
  let scanning = true;
  lines.forEach((line, i) => {
    if (line.includes('pii-scan:off')) { scanning = false; return; }
    if (line.includes('pii-scan:on')) { scanning = true; return; }
    if (!scanning) return;
    for (const r of RULES) {
      r.re.lastIndex = 0;
      let m;
      while ((m = r.re.exec(line)) !== null) {
        hits.push({ file: f.rel, line: i + 1, rule: r.id, desc: r.desc, sample: mask(m[0]) });
      }
    }
    EMAIL_RE.lastIndex = 0;
    let e;
    while ((e = EMAIL_RE.exec(line)) !== null) {
      if (!EMAIL_OK.test(e[0])) {
        hits.push({ file: f.rel, line: i + 1, rule: 'email', desc: '私人邮箱', sample: mask(e[0]) });
      }
    }
  });
}

const result = { filesScanned: files.length, hits: hits.length, details: hits.slice(0, 60) };
console.log(JSON.stringify(result, null, 2));
if (!QUIET && hits.length) {
  console.error('\n脱敏扫描失败：' + hits.length + ' 处命中，逐条如下（最多 60 条）');
  for (const h of hits.slice(0, 60)) {
    console.error('  ' + h.file + ':' + h.line + '  [' + h.rule + '] ' + h.desc + '  → ' + h.sample);
  }
  console.error('\n处理办法：删掉该内容，或改写成占位符（<仓库路径> / <用户名>），或把它移进 docs/internal/。');
}
process.exit(hits.length ? 1 : 0);
