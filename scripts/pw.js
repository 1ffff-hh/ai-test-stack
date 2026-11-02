/* Playwright 模块路径收敛点：换机器不用改代码。
   查找顺序：PLAYWRIGHT_DIR → npm 全局目录 → 用户级 npm 目录 → 仓库内 node_modules → 裸包名。
   全部失败才抛错，错误信息里不打印任何机器专属路径。 */
const path = require('path');

const CANDIDATES = [
  process.env.PLAYWRIGHT_DIR,
  process.env.npm_config_prefix && path.join(process.env.npm_config_prefix, 'node_modules', 'playwright'),
  process.env.APPDATA && path.join(process.env.APPDATA, 'npm', 'node_modules', 'playwright'),
  path.join(__dirname, '..', 'node_modules', 'playwright'),
  'playwright'
].filter(Boolean);

let mod = null;
const tried = [];
for (const c of CANDIDATES) {
  try {
    mod = require(c);
    break;
  } catch (e) {
    tried.push(c + '  (' + (e.code || e.message.split('\n')[0]) + ')');
  }
}

if (!mod) {
  throw new Error(
    '找不到 playwright。已尝试：\n  ' + tried.join('\n  ') + '\n' +
    '解决办法：npm i -g playwright（或在本仓库 npm i -D playwright）后重试；\n' +
    '也可以设环境变量 PLAYWRIGHT_DIR 指向 playwright 模块目录。'
  );
}

module.exports = mod;
