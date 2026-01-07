import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { resetDatabase, createTestUser, closeDatabase } from './setup';
import { AgentExecutor } from '../worker/executor';

// Register agents
import '../agents/simple-agent';

const app = createApp();

describe('AgentExecutor integration', () => {
  let accessToken: string;

  beforeEach(async () => {
    await resetDatabase();
    const user = await createTestUser();
    accessToken = user.accessToken;
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('should execute simple agent and get LLM response', async () => {
    // Launch a run via API
    const launchResponse = await request(app)
      .post('/api/v1/agents/simple/run')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ input: { prompt: 'What is 2+2? Reply with just the number.' } });

    expect(launchResponse.status).toBe(202);
    const runId = launchResponse.body.data.runId;

    // Execute directly (bypassing worker queue)
    const executor = new AgentExecutor(runId);
    await executor.execute();

    // Check the result
    const statusResponse = await request(app)
      .get(`/api/v1/agents/runs/${runId}?includeMessages=true`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.data.status).toBe('completed');
    expect(statusResponse.body.data.output).toBeDefined();
    expect(statusResponse.body.data.output.text).toBeDefined();
    expect(statusResponse.body.data.output.text.length).toBeGreaterThan(0);

    // Should have logged messages
    expect(statusResponse.body.data.messages.length).toBeGreaterThan(0);

    // Check that we have completion message
    const completedMessage = statusResponse.body.data.messages.find(
      (m: { message: string }) => m.message === 'Agent run completed'
    );
    expect(completedMessage).toBeDefined();
  }, 30000); // 30s timeout for LLM call

  it('should handle cancellation before step execution', async () => {
    // Launch a run
    const launchResponse = await request(app)
      .post('/api/v1/agents/simple/run')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ input: { prompt: 'Hello' } });

    const runId = launchResponse.body.data.runId;

    // Mark as cancel_requested BEFORE execution starts
    await request(app)
      .post(`/api/v1/agents/runs/${runId}/cancel`)
      .set('Authorization', `Bearer ${accessToken}`);

    // Execute - should detect cancellation before running any steps
    const executor = new AgentExecutor(runId);
    await executor.execute();

    // Check status - should be cancelled, not completed
    const statusResponse = await request(app)
      .get(`/api/v1/agents/runs/${runId}?includeMessages=true`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(statusResponse.body.data.status).toBe('cancelled');

    // Should have cancellation message
    const cancelMessage = statusResponse.body.data.messages.find(
      (m: { message: string }) => m.message === 'Run cancelled by user request'
    );
    expect(cancelMessage).toBeDefined();
  });

  it('should record step progress', async () => {
    const launchResponse = await request(app)
      .post('/api/v1/agents/simple/run')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ input: { prompt: 'Say hello' } });

    const runId = launchResponse.body.data.runId;

    const executor = new AgentExecutor(runId);
    await executor.execute();

    const statusResponse = await request(app)
      .get(`/api/v1/agents/runs/${runId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(statusResponse.body.data.currentStep).toBe(1);
    expect(statusResponse.body.data.totalSteps).toBe(1);
  }, 30000);

  it('should handle missing prompt gracefully', async () => {
    const launchResponse = await request(app)
      .post('/api/v1/agents/simple/run')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ input: {} }); // No prompt

    const runId = launchResponse.body.data.runId;

    const executor = new AgentExecutor(runId);

    // This should fail because prompt is undefined
    await expect(executor.execute()).rejects.toThrow();

    const statusResponse = await request(app)
      .get(`/api/v1/agents/runs/${runId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(statusResponse.body.data.status).toBe('failed');
    expect(statusResponse.body.data.error).toBeDefined();
  });
});
