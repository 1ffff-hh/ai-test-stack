import { createApp } from './app.js';
import { env } from './env.js';
import { logger } from './lib/logger.js';
import { prisma, disconnect } from './lib/prisma.js';
import { bootstrapAdmin } from './bootstrap.js';
import { seedFromFiles } from './modules/content/service.js';

async function main() {
  const seeded = await seedFromFiles();
  const bootPassword = await bootstrapAdmin();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`站点   http://localhost:${env.PORT}/`);
    logger.info(`后台   http://localhost:${env.PORT}/admin`);
    logger.info(`接口   http://localhost:${env.PORT}/api/v1/system/health`);
    if (seeded.length) logger.info(`首次灌库：${seeded.join(' · ')}`);
    if (bootPassword) {
      logger.warn(
        { email: env.ADMIN_EMAIL, password: bootPassword },
        '管理员账号已创建，初始密码只显示这一次；忘了就运行 npm run admin:reset',
      );
    }
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, '正在关闭');
    server.close();
    await disconnect().catch(() => undefined);
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((e) => {
  logger.error({ err: e }, '启动失败');
  void prisma.$disconnect();
  process.exit(1);
});
