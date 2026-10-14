import { rateLimit, type Options } from 'express-rate-limit';
import { HttpError } from '../lib/httpError.js';

const shared: Partial<Options> = {
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new HttpError(429, 'RATE_LIMITED', 'Too many requests. Wait a moment and try again.'));
  },
};

export const globalLimiter = rateLimit({ ...shared, windowMs: 15 * 60_000, limit: 300 });

export const authLimiter = rateLimit({ ...shared, windowMs: 15 * 60_000, limit: 20 });

// Mounted after requireAuth, so the user id is always there.
export const chatMessageLimiter = rateLimit({
  ...shared,
  windowMs: 60_000,
  limit: 20,
  keyGenerator: (req) => `user:${req.user?.id}`,
});
