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

  it('GET /api/users/me should reject request without token', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });

  it('does not expose a user list, a search or a lookup by id', async () => {
    for (const path of ['/api/users', '/api/users?search=another', `/api/users/${user.id}`, '/api/users/2']) {
      const res = await request(app).get(path).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).not.toContain('another@example.com');
    }
  });
});
