import { config } from '../config/env';
import { pool } from '../db/pool';

console.log('TEST DATABASE_URL:', config.database.url);

export async function resetDatabase(): Promise<void> {
  // Truncate tables in correct order (respecting foreign keys)
  await pool.query('TRUNCATE TABLE app.agent_run_messages CASCADE');
  await pool.query('TRUNCATE TABLE app.agent_runs CASCADE');
  await pool.query('TRUNCATE TABLE app.refresh_tokens CASCADE');
  await pool.query('TRUNCATE TABLE app.users CASCADE');
}

export async function createTestUser(): Promise<{ userId: string; accessToken: string }> {
  const { createApp } = await import('../app');
  const request = (await import('supertest')).default;
  const app = createApp();

  const testUser = {
    email: `test-agent-${Date.now()}@example.com`,
    password: 'password123',
    firstName: 'Test',
    lastName: 'User',
  };

  const registerResponse = await request(app).post('/api/v1/auth/register').send(testUser);
  return {
    userId: registerResponse.body.data.user.userId,
    accessToken: registerResponse.body.data.accessToken,
  };
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
