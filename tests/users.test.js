jest.mock('../server/db/pool', () => require('./helpers/mockDb'));

const request = require('supertest');
const app = require('../server/app');
const mockDb = require('./helpers/mockDb');

describe('Users API (/api/users)', () => {
  let token;
  let user;

  beforeEach(async () => {
    mockDb.reset();

    const u = await request(app).post('/api/auth/register').send({
      name: 'Test User',
      email: 'test@example.com',
      password: 'Password123!',
    });
    token = u.body.token;
    user = u.body.user;

    await request(app).post('/api/auth/register').send({
      name: 'Another User',
      email: 'another@example.com',
      password: 'Password123!',
    });
  });

  it('GET /api/users/me should return current user', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Test User');
    expect(res.body.user.email).toBe('test@example.com');
  });

  it('GET /api/users should list all users', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    expect(res.body[0]).not.toHaveProperty('password_hash');
  });

  it('GET /api/users?search=another should filter users', async () => {
    const res = await request(app)
      .get('/api/users?search=another')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].email).toBe('another@example.com');
  });

  it('GET /api/users/:id should return user by id', async () => {
    const res = await request(app)
      .get(`/api/users/${user.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
    expect(res.body.name).toBe('Test User');
  });

  it('GET /api/users should reject request without token', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });
});
