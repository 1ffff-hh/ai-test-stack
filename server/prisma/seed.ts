/* 把 data/*.json 灌进库。库非空时不动已有数据。用法：npm run db:seed */
import { seedFromFiles } from '../src/modules/content/service.js';
import { disconnect } from '../src/lib/prisma.js';

const seeded = await seedFromFiles();
console.log(seeded.length ? '已灌入：' + seeded.join(' · ') : '库已有数据，跳过');
await disconnect();
