import pino from 'pino';
import { env, isProd } from '../env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  ...(isProd
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
      }),
  redact: {
    paths: ['req.headers.cookie', 'req.headers.authorization', '*.password', '*.token'],
    remove: true,
  },
});
