import bcrypt from 'bcryptjs';
import { config } from '../../config.js';
import { HttpError, unauthorized } from '../../lib/httpError.js';
import { findBusinessBySlug } from '../services/services.repository.js';
import * as repo from './auth.repository.js';
import type { PublicUser } from './auth.repository.js';
import type { LoginInput, SignupInput } from './auth.schemas.js';
import { signToken, type VerifiedToken } from './auth.tokens.js';

const BCRYPT_COST = 10;

// Compared against when the email is unknown, so both paths cost one bcrypt check.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_COST);

export type Session = { user: PublicUser; token: string };

export const hashPassword = (password: string) => bcrypt.hash(password, BCRYPT_COST);

export async function defaultBusinessId(): Promise<string> {
  const business = await findBusinessBySlug(config.DEFAULT_BUSINESS_SLUG);
  if (!business) {
    throw new HttpError(500, 'INTERNAL', `Business "${config.DEFAULT_BUSINESS_SLUG}" is missing. Run npm run db:setup.`);
  }
  return business.id;
}

export async function startSession(businessId: string, userId: string): Promise<Session> {
  const user = await repo.findUserById(businessId, userId);
  if (!user) throw unauthorized();
  return { user, token: signToken({ id: user.id, businessId, role: user.role }) };
}

export async function signup(input: SignupInput): Promise<Session> {
  const businessId = await defaultBusinessId();
  const passwordHash = await hashPassword(input.password);
  // A taken email surfaces as a unique violation, mapped to 409 by the error handler.
  const userId = await repo.insertUser({ businessId, email: input.email, fullName: input.fullName, passwordHash });
  return startSession(businessId, userId);
}

export async function login(input: LoginInput): Promise<Session> {
  const businessId = await defaultBusinessId();
  const credentials = await repo.findCredentials(businessId, input.email);
  const passwordMatches = await bcrypt.compare(input.password, credentials?.passwordHash ?? DUMMY_HASH);
  if (!credentials || !passwordMatches) {
    throw unauthorized('Email or password is incorrect.');
  }
  return startSession(businessId, credentials.id);
}

export async function getCurrentUser(businessId: string, userId: string): Promise<PublicUser> {
  const user = await repo.findUserById(businessId, userId);
  if (!user) throw unauthorized();
  return user;
}

/** False once the password has changed after the token was issued, or the user is gone. */
export async function isSessionCurrent(token: VerifiedToken): Promise<boolean> {
  const changedAt = await repo.findPasswordChangedAt(token.businessId, token.id);
  // JWT iat has whole-second precision, so compare at that precision.
  return changedAt !== null && Math.floor(changedAt.getTime() / 1000) <= token.issuedAt;
}
