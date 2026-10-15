import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import type { Queryable } from './db.js';

const dbDir = fileURLToPath(new URL('../db/', import.meta.url));

export async function loadSchemaAndSeed(db: pg.Client | Queryable): Promise<void> {
  for (const file of ['schema.sql', 'seed.sql']) {
    await db.query(await readFile(dbDir + file, 'utf8'));
  }
}

/**
 * For hosts without a shell (Render's free tier): on first start against an empty
 * database, create the tables and demo data. Never touches a database that has them.
 */
export async function ensureSchema(db: Queryable): Promise<boolean> {
  const { rows } = await db.query<{ exists: boolean }>("SELECT to_regclass('public.users') IS NOT NULL AS exists");
  if (rows[0]?.exists) return false;
  await loadSchemaAndSeed(db);
  return true;
}
