import pg from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
});

// Repositories accept either the pool or a transaction client.
export type Queryable = pg.Pool | pg.PoolClient;

export async function query<Row extends pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
  db: Queryable = pool,
): Promise<Row[]> {
  const result = await db.query<Row>(text, params);
  return result.rows;
}

export async function withTransaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
