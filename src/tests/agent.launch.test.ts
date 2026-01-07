import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { resetDatabase, createTestUser, closeDatabase } from './setup';

const app = createApp();

describe('POST /api/v1/agents/:agentType/run', () => {
  let accessToken: string;

  beforeEach(async () => {
    await resetDatabase();
    const user = await createTestUser();
    accessToken = user.accessToken;
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('should launch an agent run successfully', async () => {
    const response = await request(app)
      .post('/api/v1/agents/simple/run')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        input: { prompt: 'Hello, world!' },
      });

    expect(response.status).toBe(202);
    expect(response.body.status).toBe('success');
    expect(response.body.data).toHaveProperty('runId');
    expect(response.body.data).toHaveProperty('status', 'pending');
    expect(response.body.data).toHaveProperty('pollUrl');
    expect(response.body.data).toHaveProperty('createdAt');
  });

  it('should accept empty input payload', async () => {
    const response = await request(app)
      .post('/api/v1/agents/simple/run')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(response.status).toBe(202);
    expect(response.body.data).toHaveProperty('runId');
  });

  it('should return 401 without auth token', async () => {
    const response = await request(app)
      .post('/api/v1/agents/simple/run')
      .send({ input: { prompt: 'test' } });

    expect(response.status).toBe(401);
  });

  it('should return 401 with invalid auth token', async () => {
    const response = await request(app)
      .post('/api/v1/agents/simple/run')
      .set('Authorization', 'Bearer invalid-token')
      .send({ input: { prompt: 'test' } });

    expect(response.status).toBe(401);
  });

  it('should store input payload correctly', async () => {
    const inputPayload = { prompt: 'Test prompt', options: { temperature: 0.7 } };

    const launchResponse = await request(app)
      .post('/api/v1/agents/simple/run')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ input: inputPayload });

    expect(launchResponse.status).toBe(202);
    const runId = launchResponse.body.data.runId;

    // Fetch the run and verify input was stored
    const statusResponse = await request(app)
      .get(`/api/v1/agents/runs/${runId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.data.input).toEqual(inputPayload);
  });
});
