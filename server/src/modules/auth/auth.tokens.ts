import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../../config.js';
import { durationToMs } from '../../lib/time.js';

export const roles = ['customer', 'staff', 'admin'] as const;
export type Role = (typeof roles)[number];

export type AuthUser = { id: string; businessId: string; role: Role };
/** issuedAt is the JWT iat, in seconds. */
export type VerifiedToken = AuthUser & { issuedAt: number };

export const TOKEN_COOKIE = 'ms_token';
export const tokenTtlMs = durationToMs(config.JWT_EXPIRES_IN);

const claimsSchema = z.object({
  sub: z.uuid(),
  bid: z.uuid(),
  role: z.enum(roles),
  iat: z.number().int(),
});

export function signToken(user: AuthUser): string {
  return jwt.sign({ bid: user.businessId, role: user.role }, config.JWT_SECRET, {
    subject: user.id,
    expiresIn: Math.floor(tokenTtlMs / 1000),
    algorithm: 'HS256',
  });
}

/** Returns null for anything that isn't a valid, unexpired token of ours. */
export function verifyToken(token: string): VerifiedToken | null {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] });
    const claims = claimsSchema.safeParse(decoded);
    if (!claims.success) return null;
    const { sub, bid, role, iat } = claims.data;
    return { id: sub, businessId: bid, role, issuedAt: iat };
  } catch {
    return null;
  }
}
