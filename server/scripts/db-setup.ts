// Drops and recreates the database named in DATABASE_URL, then loads schema.sql and seed.sql.
// Also imported by the test global setup to build medslot_test.
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const dbDir = fileURLToPath(new URL('../db/', import.meta.url));

export async function setupDatabase(databaseUrl: string): Promise<void> {
  const target = new URL(databaseUrl);
  const dbName = decodeURIComponent(target.pathname.slice(1));
  if (!/^[a-z_][a-z0-9_]*$/.test(dbName)) {
    throw new Error(`Refusing to recreate database with unusual name "${dbName}"`);
  }

  const maintenanceUrl = new URL(databaseUrl);
  maintenanceUrl.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: maintenanceUrl.toString() });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${dbName}`);
  } finally {
    await admin.end();
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    for (const file of ['schema.sql', 'seed.sql']) {
      await client.query(await readFile(dbDir + file, 'utf8'));
    }
  } finally {
    await client.end();
  }
}

const runDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (runDirectly) {
  dotenv.config({ quiet: true });
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. Copy .env.example to .env first.');
    process.exit(1);
  }
  setupDatabase(url)
    .then(() => console.log(`Database ready: ${new URL(url).pathname.slice(1)} (schema + seed loaded)`))
    .catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    });
}
