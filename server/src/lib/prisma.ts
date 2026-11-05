import '../env.js';
import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

export const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'warn' },
    { emit: 'event', level: 'error' },
  ],
});

prisma.$on('warn', (e) => logger.warn({ prisma: e.message }, 'prisma warning'));
prisma.$on('error', (e) => logger.error({ prisma: e.message }, 'prisma error'));

export async function disconnect() {
  await prisma.$disconnect();
}
