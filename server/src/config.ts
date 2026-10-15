import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET should be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().regex(/^\d+[smhd]$/, 'Use a number plus s, m, h or d, e.g. 7d').default('7d'),
  // Render sets RENDER_EXTERNAL_URL; the site and API share that origin in production.
  CLIENT_ORIGIN: z.string().url().default(process.env.RENDER_EXTERNAL_URL ?? 'http://localhost:5173'),
  // Managed Postgres reached over the internet (Heroku, Render's external URL) needs TLS.
  DATABASE_SSL: z.stringbool().default(false),
  // Proxies in front of the app (Render/Heroku router = 1), so rate limits see the real client IP.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  DEFAULT_BUSINESS_SLUG: z.string().min(1).default('harbor-street'),
  MISTRAL_API_KEY: z.string().optional().transform((value) => value || undefined),
  MISTRAL_MODEL: z.string().min(1).default('open-mistral-nemo'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}

export const config = parsed.data;
export const isProduction = config.NODE_ENV === 'production';
