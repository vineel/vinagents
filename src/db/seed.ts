import { pool } from './pool';
import { logger } from '../utils/logger';
import { readFileSync } from 'fs';
import { join } from 'path';

const schema = readFileSync(join(__dirname, '../notes/pg-setup.txt'), 'utf-8');


async function seed() {
  const client = await pool.connect();

  try {
    logger.info('Starting database seeding...');

    await client.query('BEGIN');
    await client.query(schema);
    await client.query('COMMIT');

    logger.info('✓ Database schema created successfully');
    logger.info('✓ Database seeding completed');

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Database seeding failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed()
  .then(() => {
    logger.info('Seed script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Seed script failed:', error);
    process.exit(1);
  });
