import type { Request, RequestHandler } from 'express';
import { unauthorized } from '../lib/httpError.js';
import { TOKEN_COOKIE, verifyToken, type AuthUser } from '../modules/auth/auth.tokens.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function readToken(req: Request): string | undefined {
  const cookie: unknown = req.cookies?.[TOKEN_COOKIE];
  if (typeof cookie === 'string' && cookie) return cookie;

  const header = req.get('authorization');
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length).trim();
  return undefined;
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = readToken(req);
  const user = token ? verifyToken(token) : null;
  if (!user) throw unauthorized();
  req.user = user;
  next();
};

/** For handlers mounted behind requireAuth. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
