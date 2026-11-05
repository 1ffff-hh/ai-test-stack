/* 命令行发布：库 → data/*.json → 重建静态站。用法：npm run publish */
import { publish } from '../modules/system/service.js';
import { disconnect } from '../lib/prisma.js';

const result = await publish();

if (result.ok) {
  console.log('已导出：' + result.files.join(' · '));
  if (result.build) console.log(result.build);
} else {
  console.error(result.msg || '发布失败');
}

await disconnect();
process.exit(result.ok ? 0 : 1);
