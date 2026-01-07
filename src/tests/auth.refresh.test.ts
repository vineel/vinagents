import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { resetDatabase, closeDatabase } from './setup';

const app = createApp();

describe('POST /api/v1/auth/refresh', () => {
  let validRefreshToken: string;

  beforeEach(async () => {
    await resetDatabase();
    // Create a user and get tokens
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
      });
    validRefreshToken = response.body.data.refreshToken;
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('should return new tokens with valid refresh token', async () => {
    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken: validRefreshToken,
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('success');
    expect(response.body.data).toHaveProperty('user');
    expect(response.body.data).toHaveProperty('accessToken');
    expect(response.body.data).toHaveProperty('refreshToken');
  });

  it('should invalidate old refresh token after use', async () => {
    // Use the refresh token and get a new one
    const firstRefresh = await request(app)
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken: validRefreshToken,
      });

    const newRefreshToken = firstRefresh.body.data.refreshToken;

    // Wait to ensure different JWT timestamp if tokens would be regenerated
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Use the NEW refresh token - this should work
    const secondRefresh = await request(app)
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken: newRefreshToken,
      });

    expect(secondRefresh.status).toBe(200);

    // Now the newRefreshToken should be invalid
    const thirdRefresh = await request(app)
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken: newRefreshToken,
      });

    expect(thirdRefresh.status).toBe(401);
  });

  it('should return 401 with invalid refresh token', async () => {
    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken: 'invalid-token',
      });

    expect(response.status).toBe(401);
  });

  it('should return 422 when refresh token is missing', async () => {
    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .send({});

    expect(response.status).toBe(422);
  });
});
