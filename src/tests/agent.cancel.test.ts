import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { resetDatabase, createTestUser, closeDatabase } from './setup';
import { pool } from '../db/pool';

const app = createApp();

describe('POST /api/v1/agents/runs/:runId/cancel', () => {
  let accessToken: string;
  let runId: string;

  beforeEach(async () => {
    await resetDatabase();
    const user = await createTestUser();
    accessToken = user.accessToken;

    // Create a run to test with
    const launchResponse = await request(app)
      .post('/api/v1/agents/simple/run')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ input: { prompt: 'Test prompt' } });

    runId = launchResponse.body.data.runId;
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('should cancel a pending run', async () => {
    const response = await request(app)
      .post(`/api/v1/agents/runs/${runId}/cancel`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('success');
    expect(response.body.data).toHaveProperty('runId', runId);
    expect(['cancel_requested', 'cancelled']).toContain(response.body.data.status);
  });

  it('should update run status after cancellation', async () => {
    await request(app)
      .post(`/api/v1/agents/runs/${runId}/cancel`)
      .set('Authorization', `Bearer ${accessToken}`);

    const statusResponse = await request(app)
      .get(`/api/v1/agents/runs/${runId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(statusResponse.status).toBe(200);
    expect(['cancel_requested', 'cancelled']).toContain(statusResponse.body.data.status);
  });

  it('should return 400 when cancelling already completed run', async () => {
    // Manually mark the run as completed
    await pool.query(
      `UPDATE app.agent_runs SET status = 'completed', completed_at = NOW() WHERE agent_run_id = $1`,
      [runId]
    );

    const response = await request(app)
      .post(`/api/v1/agents/runs/${runId}/cancel`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
  });

  it('should return 400 when cancelling already failed run', async () => {
    // Manually mark the run as failed
    await pool.query(
      `UPDATE app.agent_runs SET status = 'failed', completed_at = NOW() WHERE agent_run_id = $1`,
      [runId]
    );

    const response = await request(app)
      .post(`/api/v1/agents/runs/${runId}/cancel`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
  });

  it('should return 404 for non-existent run', async () => {
    const fakeRunId = '00000000-0000-0000-0000-000000000000';
    const response = await request(app)
      .post(`/api/v1/agents/runs/${fakeRunId}/cancel`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
  });

  it('should return 401 without auth token', async () => {
    const response = await request(app)
      .post(`/api/v1/agents/runs/${runId}/cancel`);

    expect(response.status).toBe(401);
  });

  it('should not allow cancelling another user\'s run', async () => {
    const otherUser = await createTestUser();

    const response = await request(app)
      .post(`/api/v1/agents/runs/${runId}/cancel`)
      .set('Authorization', `Bearer ${otherUser.accessToken}`);

    expect(response.status).toBe(404);
  });
});
