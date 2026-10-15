import type { Queryable } from '../../db.js';
import { query } from '../../db.js';

export async function insertResetToken(
  input: { businessId: string; userId: string; tokenHash: string; expiresAt: Date },
  db: Queryable,
): Promise<void> {
  await query(
    `INSERT INTO password_reset_tokens (business_id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [input.businessId, input.userId, input.tokenHash, input.expiresAt],
    db,
  );
}

/** Marks every open link for the user as used, so only the newest one (or none) works. */
export async function revokeResetTokens(userId: string, db: Queryable): Promise<void> {
  await query('UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [userId], db);
}

/**
 * Uses the token in one statement: two requests racing with the same link can't
 * both get it, because only one UPDATE matches `used_at IS NULL`.
 */
export async function claimResetToken(tokenHash: string, db: Queryable): Promise<{ userId: string } | null> {
  const rows = await query<{ user_id: string }>(
    `UPDATE password_reset_tokens SET used_at = now()
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
     RETURNING user_id`,
    [tokenHash],
    db,
  );
  return rows[0] ? { userId: rows[0].user_id } : null;
}
