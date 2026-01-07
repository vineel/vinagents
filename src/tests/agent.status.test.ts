import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { resetDatabase, createTestUser, closeDatabase } from './setup';

const app = createApp();

describe('GET /api/v1/agents/runs/:runId', () => {
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

  it('should return run status', async () => {
    const response = await request(app)
      .get(`/api/v1/agents/runs/${runId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('success');
    expect(response.body.data).toHaveProperty('runId', runId);
    expect(response.body.data).toHaveProperty('agentType', 'simple');
    expect(response.body.data).toHaveProperty('status');
    expect(response.body.data).toHaveProperty('createdAt');
  });

  it('should include messages when requested', async () => {
    const response = await request(app)
      .get(`/api/v1/agents/runs/${runId}?includeMessages=true`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty('messages');
    expect(Array.isArray(response.body.data.messages)).toBe(true);
  });

  it('should not include messages by default', async () => {
    const response = await request(app)
      .get(`/api/v1/agents/runs/${runId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).not.toHaveProperty('messages');
  });

  it('should return 404 for non-existent run', async () => {
    const fakeRunId = '00000000-0000-0000-0000-000000000000';
    const response = await request(app)
      .get(`/api/v1/agents/runs/${fakeRunId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
  });

  it('should return 401 without auth token', async () => {
    const response = await request(app)
      .get(`/api/v1/agents/runs/${runId}`);

    expect(response.status).toBe(401);
  });

  it('should not allow access to another user\'s run', async () => {
    // Create another user
    const otherUser = await createTestUser();

    const response = await request(app)
      .get(`/api/v1/agents/runs/${runId}`)
      .set('Authorization', `Bearer ${otherUser.accessToken}`);

    expect(response.status).toBe(404);
  });
});
