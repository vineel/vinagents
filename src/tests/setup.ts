import dotenv from 'dotenv';
import path from 'path';

// Load test environment BEFORE importing anything else
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

import { pool } from '../db/pool';

export async function resetDatabase(): Promise<void> {
  // Truncate tables in correct order (respecting foreign keys)
  await pool.query('TRUNCATE TABLE app.refresh_tokens CASCADE');
  await pool.query('TRUNCATE TABLE app.users CASCADE');
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
