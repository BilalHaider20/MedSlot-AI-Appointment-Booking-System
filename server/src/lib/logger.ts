import { pino } from 'pino';
import { config } from '../config.js';

const defaultLevel = config.NODE_ENV === 'test' ? 'silent' : 'info';

export const logger = pino({
  level: config.LOG_LEVEL ?? defaultLevel,
  redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
  ...(config.NODE_ENV === 'development' && {
    transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname', singleLine: true } },
  }),
});
