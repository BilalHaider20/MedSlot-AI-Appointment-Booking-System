import type { Request, RequestHandler } from 'express';
import { unauthorized } from '../lib/httpError.js';
import { isSessionCurrent } from '../modules/auth/auth.service.js';
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

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const token = readToken(req);
  const verified = token ? verifyToken(token) : null;
  // One indexed lookup per request buys real logout-everywhere after a password change.
  if (!verified || !(await isSessionCurrent(verified))) throw unauthorized();
  const { id, businessId, role } = verified;
  req.user = { id, businessId, role };
  next();
};

/** For handlers mounted behind requireAuth. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
