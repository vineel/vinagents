import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { resetDatabase, closeDatabase } from './setup';

const app = createApp();

describe('POST /api/v1/auth/register', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('should register a new user successfully', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
      });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('success');
    expect(response.body.data).toHaveProperty('user');
    expect(response.body.data).toHaveProperty('accessToken');
    expect(response.body.data).toHaveProperty('refreshToken');
    expect(response.body.data.user.email).toBe('test@example.com');
    expect(response.body.data.user).not.toHaveProperty('password');
  });

  it('should register a user with optional firstName and lastName', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.user.firstName).toBe('John');
    expect(response.body.data.user.lastName).toBe('Doe');
  });

  it('should return 422 when email is missing', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        password: 'password123',
      });

    expect(response.status).toBe(422);
  });

  it('should return 422 when email format is invalid', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'not-an-email',
        password: 'password123',
      });

    expect(response.status).toBe(422);
  });

  it('should return 422 when password is too short', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'test@example.com',
        password: 'short',
      });

    expect(response.status).toBe(422);
  });

  it('should return 409 when email already exists', async () => {
    // First registration
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'duplicate@example.com',
        password: 'password123',
      });

    // Second registration with same email
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'duplicate@example.com',
        password: 'password456',
      });

    expect(response.status).toBe(409);
  });
});
