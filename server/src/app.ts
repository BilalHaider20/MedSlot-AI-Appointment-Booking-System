import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { fileURLToPath } from 'node:url';
import { pinoHttp } from 'pino-http';
import { config, isProduction } from './config.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { appointmentsRouter } from './modules/appointments/appointments.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { chatRouter } from './modules/chat/chat.routes.js';
import { servicesRouter } from './modules/services/services.routes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY_HOPS);
  app.use(helmet());
  app.use(cors({ origin: config.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '20kb' }));
  app.use(cookieParser());
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/api/health' },
      // One short line per request; headers (and so cookies) never reach the log.
      serializers: {
        req: (req: { id: unknown; method: string; url: string }) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use(globalLimiter);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api', authRouter, servicesRouter, appointmentsRouter, chatRouter);
  if (isProduction) serveClient(app);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

/**
 * In production the API also serves the built React app, so both share one origin
 * and the httpOnly cookie stays first-party. Hashed assets cache for a year;
 * index.html is never cached so a deploy shows up on the next load.
 */
function serveClient(app: Express) {
  const dist = fileURLToPath(new URL('../../client/dist/', import.meta.url));
  app.use('/assets', express.static(dist + 'assets', { immutable: true, maxAge: '1y' }));
  app.use(express.static(dist, { index: false }));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.set('Cache-Control', 'no-cache').sendFile(dist + 'index.html');
  });
}
