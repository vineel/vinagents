import { config } from '../config/env';
import { pool } from '../db/pool';

console.log('TEST DATABASE_URL:', config.database.url);

export async function resetDatabase(): Promise<void> {
  // Truncate tables in correct order (respecting foreign keys)
  await pool.query('TRUNCATE TABLE app.refresh_tokens CASCADE');
  await pool.query('TRUNCATE TABLE app.users CASCADE');
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
