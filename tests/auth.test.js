jest.mock('../server/db/pool', () => require('./helpers/mockDb'));

const request = require('supertest');
const app = require('../server/app');
const mockDb = require('./helpers/mockDb');

describe('Auth API (/api/auth)', () => {
  beforeEach(() => {
    mockDb.reset();
  });

  describe('POST /api/auth/register', () => {
    it('should fail with 400 when required fields are missing or invalid', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: '', email: 'notanemail', password: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
      expect(Array.isArray(res.body.details)).toBe(true);
      expect(res.body.details.length).toBe(3);
      expect(res.body.details.map((d) => d.field)).toEqual(['name', 'email', 'password']);
    });

    it('should register a new user and return 201 with token and user object', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Alice Cooper',
          email: 'alice@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toEqual({
        id: expect.any(Number),
        name: 'Alice Cooper',
        email: 'alice@example.com',
      });
      expect(res.body.user).not.toHaveProperty('password_hash');
    });

    it('should return 409 when registering an already registered email', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Alice Cooper',
          email: 'alice@example.com',
          password: 'Password123!',
        });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Alice Duplicate',
          email: 'ALICE@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Email already registered');
      expect(Array.isArray(res.body.details)).toBe(true);
      expect(res.body.details[0].field).toBe('email');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Alice Cooper',
          email: 'alice@example.com',
          password: 'Password123!',
        });
    });

    it('should fail with 400 on empty fields', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: '', password: '' });

      expect(res.status).toBe(400);
      expect(Array.isArray(res.body.details)).toBe(true);
      expect(res.body.details.length).toBeGreaterThan(0);
    });

    it('should fail with 401 on wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'alice@example.com', password: 'WrongPassword!' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
      expect(Array.isArray(res.body.details)).toBe(true);
      expect(res.body.details).toEqual([]);
    });

    it('should fail with 401 on non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'Password123!' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
      expect(Array.isArray(res.body.details)).toBe(true);
    });

    it('should successfully log in and return 200 with token and user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'alice@example.com', password: 'Password123!' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toEqual({
        id: expect.any(Number),
        name: 'Alice Cooper',
        email: 'alice@example.com',
      });
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(Array.isArray(res.body.details)).toBe(true);
    });

    it('should return current user with valid token', async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Bob Ross',
          email: 'bob@example.com',
          password: 'Password123!',
        });

      const token = regRes.body.token;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe('Bob Ross');
      expect(res.body.user.email).toBe('bob@example.com');
    });
  });
});
