import { query } from '../../db.js';
import type { Role } from './auth.tokens.js';

export type PublicUser = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  business: { id: string; name: string; timezone: string };
};

type UserRow = {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  business_id: string;
  business_name: string;
  business_timezone: string;
};

// password_hash is never part of this select; only findCredentials reads it.
const userSelect = `
  SELECT u.id, u.full_name, u.email, u.role,
         b.id AS business_id, b.name AS business_name, b.timezone AS business_timezone
  FROM users u
  JOIN businesses b ON b.id = u.business_id`;

const toPublicUser = (row: UserRow): PublicUser => ({
  id: row.id,
  fullName: row.full_name,
  email: row.email,
  role: row.role,
  business: { id: row.business_id, name: row.business_name, timezone: row.business_timezone },
});

export async function findUserById(businessId: string, userId: string): Promise<PublicUser | null> {
  const rows = await query<UserRow>(`${userSelect} WHERE u.business_id = $1 AND u.id = $2`, [businessId, userId]);
  return rows[0] ? toPublicUser(rows[0]) : null;
}

export async function findCredentials(
  businessId: string,
  email: string,
): Promise<{ id: string; passwordHash: string } | null> {
  const rows = await query<{ id: string; password_hash: string }>(
    'SELECT id, password_hash FROM users WHERE business_id = $1 AND email = $2',
    [businessId, email],
  );
  return rows[0] ? { id: rows[0].id, passwordHash: rows[0].password_hash } : null;
}

export async function insertUser(input: {
  businessId: string;
  email: string;
  fullName: string;
  passwordHash: string;
}): Promise<string> {
  const rows = await query<{ id: string }>(
    `INSERT INTO users (business_id, email, full_name, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [input.businessId, input.email, input.fullName, input.passwordHash],
  );
  return rows[0]!.id;
}
