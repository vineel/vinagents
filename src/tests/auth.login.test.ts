import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { resetDatabase, closeDatabase } from './setup';

const app = createApp();

describe('POST /api/v1/auth/login', () => {
  const testUser = {
    email: 'test@example.com',
    password: 'password123',
    firstName: 'Test',
    lastName: 'User',
  };

  beforeEach(async () => {
    await resetDatabase();
    // Create a user to login with
    await request(app).post('/api/v1/auth/register').send(testUser);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('should login successfully with valid credentials', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('success');
    expect(response.body.data).toHaveProperty('user');
    expect(response.body.data).toHaveProperty('accessToken');
    expect(response.body.data).toHaveProperty('refreshToken');
    expect(response.body.data.user.email).toBe(testUser.email);
    expect(response.body.data.user).not.toHaveProperty('password');
  });

  it('should return 401 with wrong password', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: 'wrongpassword',
      });

    expect(response.status).toBe(401);
  });

  it('should return 401 with non-existent email', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'nobody@example.com',
        password: 'password123',
      });

    expect(response.status).toBe(401);
  });

  it('should return 422 when email is missing', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        password: 'password123',
      });

    expect(response.status).toBe(422);
  });

  it('should return 422 when password is missing', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
      });

    expect(response.status).toBe(422);
  });
});
