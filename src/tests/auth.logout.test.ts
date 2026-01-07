import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { resetDatabase, closeDatabase } from './setup';

const app = createApp();

describe('POST /api/v1/auth/logout', () => {
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

  it('should logout successfully with valid refresh token', async () => {
    const response = await request(app)
      .post('/api/v1/auth/logout')
      .send({
        refreshToken: validRefreshToken,
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('success');
    expect(response.body.message).toBe('Logged out successfully');
  });

  it('should invalidate refresh token after logout', async () => {
    // Logout
    await request(app)
      .post('/api/v1/auth/logout')
      .send({
        refreshToken: validRefreshToken,
      });

    // Try to use the refresh token
    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken: validRefreshToken,
      });

    expect(response.status).toBe(401);
  });

  it('should return 200 even with invalid refresh token (idempotent)', async () => {
    const response = await request(app)
      .post('/api/v1/auth/logout')
      .send({
        refreshToken: 'invalid-token',
      });

    // Logout is idempotent - doesn't fail if token doesn't exist
    expect(response.status).toBe(200);
  });

  it('should return 422 when refresh token is missing', async () => {
    const response = await request(app)
      .post('/api/v1/auth/logout')
      .send({});

    expect(response.status).toBe(422);
  });
});
