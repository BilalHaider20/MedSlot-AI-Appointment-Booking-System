import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';
import { ensureSchema } from './dbSchema.js';
import { logger } from './lib/logger.js';

if (await ensureSchema(pool)) logger.info('Empty database: loaded schema and demo data');

const server = createApp().listen(config.PORT, () => {
  const ai = config.MISTRAL_API_KEY ? `mistral (${config.MISTRAL_MODEL})` : 'rules only';
  logger.info(`Medslot API listening on port ${config.PORT} (extractor: ${ai})`);
});

function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
  // Don't hang forever on a keep-alive connection.
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
