import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { resetDatabase, createTestUser, closeDatabase } from './setup';
import { pool } from '../db/pool';

const app = createApp();

describe('GET /api/v1/agents/runs', () => {
  let accessToken: string;
  let userId: string;

  beforeEach(async () => {
    await resetDatabase();
    const user = await createTestUser();
    accessToken = user.accessToken;
    userId = user.userId;
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('should return empty list when no runs exist', async () => {
    const response = await request(app)
      .get('/api/v1/agents/runs')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('success');
    expect(response.body.data).toHaveProperty('runs');
    expect(response.body.data.runs).toHaveLength(0);
    expect(response.body.data.pagination.total).toBe(0);
  });

  it('should return list of runs', async () => {
    // Create a few runs
    await request(app)
      .post('/api/v1/agents/simple/run')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ input: { prompt: 'Test 1' } });

    await request(app)
      .post('/api/v1/agents/simple/run')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ input: { prompt: 'Test 2' } });

    const response = await request(app)
      .get('/api/v1/agents/runs')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.runs).toHaveLength(2);
    expect(response.body.data.pagination.total).toBe(2);
  });

  it('should filter by status', async () => {
    // Create a run
    const launchResponse = await request(app)
      .post('/api/v1/agents/simple/run')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ input: { prompt: 'Test' } });

    const runId = launchResponse.body.data.runId;

    // Manually mark one as completed
    await pool.query(
      `UPDATE app.agent_runs SET status = 'completed', completed_at = NOW() WHERE agent_run_id = $1`,
      [runId]
    );

    // Create another pending run
    await request(app)
      .post('/api/v1/agents/simple/run')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ input: { prompt: 'Test 2' } });

    // Filter by completed
    const completedResponse = await request(app)
      .get('/api/v1/agents/runs?status=completed')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(completedResponse.status).toBe(200);
    expect(completedResponse.body.data.runs).toHaveLength(1);
    expect(completedResponse.body.data.runs[0].status).toBe('completed');

    // Filter by pending
    const pendingResponse = await request(app)
      .get('/api/v1/agents/runs?status=pending')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(pendingResponse.status).toBe(200);
    expect(pendingResponse.body.data.runs).toHaveLength(1);
    expect(pendingResponse.body.data.runs[0].status).toBe('pending');
  });

  it('should filter by agentType', async () => {
    // Create runs with different agent types
    await request(app)
      .post('/api/v1/agents/simple/run')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ input: { prompt: 'Simple test' } });

    await request(app)
      .post('/api/v1/agents/analysis/run')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ input: { text: 'Analysis test' } });

    const response = await request(app)
      .get('/api/v1/agents/runs?agentType=simple')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.runs).toHaveLength(1);
    expect(response.body.data.runs[0].agentType).toBe('simple');
  });

  it('should support pagination with limit and offset', async () => {
    // Create 5 runs
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/v1/agents/simple/run')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ input: { prompt: `Test ${i}` } });
    }

    // Get first 2
    const firstPage = await request(app)
      .get('/api/v1/agents/runs?limit=2&offset=0')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(firstPage.status).toBe(200);
    expect(firstPage.body.data.runs).toHaveLength(2);
    expect(firstPage.body.data.pagination.total).toBe(5);
    expect(firstPage.body.data.pagination.limit).toBe(2);
    expect(firstPage.body.data.pagination.offset).toBe(0);

    // Get next 2
    const secondPage = await request(app)
      .get('/api/v1/agents/runs?limit=2&offset=2')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(secondPage.status).toBe(200);
    expect(secondPage.body.data.runs).toHaveLength(2);
    expect(secondPage.body.data.pagination.offset).toBe(2);
  });

  it('should only return current user\'s runs', async () => {
    // Create a run for current user
    await request(app)
      .post('/api/v1/agents/simple/run')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ input: { prompt: 'My run' } });

    // Create another user and a run for them
    const otherUser = await createTestUser();
    await request(app)
      .post('/api/v1/agents/simple/run')
      .set('Authorization', `Bearer ${otherUser.accessToken}`)
      .send({ input: { prompt: 'Other user run' } });

    // Current user should only see their run
    const response = await request(app)
      .get('/api/v1/agents/runs')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.runs).toHaveLength(1);
    expect(response.body.data.pagination.total).toBe(1);
  });

  it('should return 401 without auth token', async () => {
    const response = await request(app)
      .get('/api/v1/agents/runs');

    expect(response.status).toBe(401);
  });
});
