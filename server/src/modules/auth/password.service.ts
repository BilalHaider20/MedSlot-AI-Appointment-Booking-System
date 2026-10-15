import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { config } from '../../config.js';
import { withTransaction } from '../../db.js';
import { badRequest } from '../../lib/httpError.js';
import { sendEmail } from '../../lib/mailer.js';
import * as authRepo from './auth.repository.js';
import { defaultBusinessId, hashPassword, startSession, type Session } from './auth.service.js';
import type { AuthUser } from './auth.tokens.js';
import * as repo from './password.repository.js';

const RESET_LINK_TTL_MINUTES = 30;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

function resetEmailText(name: string, link: string) {
  return [
    `Hi ${name},`,
    '',
    'Someone asked to reset the password for your Medslot account. If it was you, open this link to choose a new one:',
    link,
    '',
    `The link works once and expires in ${RESET_LINK_TTL_MINUTES} minutes. If you didn't ask for this, you can ignore this email.`,
  ].join('\n');
}

/** Emails a reset link if the address has an account. Callers can't tell either way. */
export async function requestPasswordReset(email: string): Promise<void> {
  const businessId = await defaultBusinessId();
  const user = await authRepo.findUserByEmail(businessId, email);
  if (!user) return;

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + RESET_LINK_TTL_MINUTES * 60_000);
  await withTransaction(async (client) => {
    await repo.revokeResetTokens(user.id, client);
    await repo.insertResetToken({ businessId, userId: user.id, tokenHash: hashToken(token), expiresAt }, client);
  });

  const link = `${config.CLIENT_ORIGIN}/reset-password?token=${token}`;
  await sendEmail({ to: user.email, subject: 'Reset your Medslot password', text: resetEmailText(user.fullName, link) });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const passwordHash = await hashPassword(password);
  await withTransaction(async (client) => {
    const claimed = await repo.claimResetToken(hashToken(token), client);
    if (!claimed) throw badRequest('This reset link has expired or was already used. Ask for a new one.');
    await authRepo.updatePassword(claimed.userId, passwordHash, client);
    await repo.revokeResetTokens(claimed.userId, client);
  });
}

/** Returns a fresh session: every other session ends because password_changed_at moved. */
export async function changePassword(user: AuthUser, currentPassword: string, newPassword: string): Promise<Session> {
  const currentHash = await authRepo.findPasswordHash(user.businessId, user.id);
  if (!currentHash || !(await bcrypt.compare(currentPassword, currentHash))) {
    throw badRequest('Some fields are missing or invalid.', [
      { path: 'currentPassword', message: "That isn't your current password." },
    ]);
  }
  await authRepo.updatePassword(user.id, await hashPassword(newPassword));
  return startSession(user.businessId, user.id);
}
