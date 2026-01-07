import { runMigrations } from 'graphile-worker';
import { pool } from '../db/pool';

async function setupWorkerSchema() {
  console.log('Setting up graphile-worker schema...');
  await runMigrations({ pgPool: pool });
  console.log('Graphile-worker schema created successfully');
  await pool.end();
}

setupWorkerSchema().catch((err) => {
  console.error('Failed to set up worker schema:', err);
  process.exit(1);
});
