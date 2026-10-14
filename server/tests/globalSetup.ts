import { setupDatabase } from '../scripts/db-setup.js';
import { TEST_DATABASE_URL } from './testDatabase.js';

// Fresh schema + seed once per `npm test` run.
export default async function setup() {
  await setupDatabase(TEST_DATABASE_URL);
}
