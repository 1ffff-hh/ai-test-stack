/* 浏览器启动收敛点：本地优先用系统 Chrome，CI 上没有 Chrome 时自动退回 Playwright 自带 chromium。
   想强制指定就设 PW_CHANNEL=chrome|chromium|msedge。所有脚本都从这里启动，不要在别处直接 chromium.launch。 */
const { chromium } = require('./pw');

async function launch(opts = {}) {
  const order = process.env.PW_CHANNEL ? [process.env.PW_CHANNEL] : ['chrome', 'chromium'];
  const tried = [];
  for (const channel of order) {
    try {
      const o = { ...opts };
      if (channel !== 'chromium') o.channel = channel;   // chromium = 用 Playwright 自带的那份
      return await chromium.launch(o);
    } catch (e) {
      tried.push(channel + ' → ' + e.message.split('\n')[0]);
    }
  }
  throw new Error(
    '启动浏览器失败。已尝试：\n  ' + tried.join('\n  ') + '\n' +
    '本机装了 Chrome 就能直跑；CI 上先 npx playwright install --with-deps chromium。'
  );
}

module.exports = { launch, chromium };
