jest.mock('../server/db/pool', () => require('./helpers/mockDb'));

const request = require('supertest');
const app = require('../server/app');
const mockDb = require('./helpers/mockDb');
const { parseId } = require('../server/utils/ids');
const errorHandler = require('../server/middleware/errorHandler');

// Input that used to reach the database (or crash a controller) and come back
// as 500. Each case must now be a clean 400 with the standard error shape.
describe('Input validation edge cases', () => {
  let token;
  let projectId;
  let taskId;

  const auth = (req) => req.set('Authorization', `Bearer ${token}`);

  function expectFieldError(res, field) {
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.details.map((d) => d.field)).toContain(field);
  }

  beforeEach(async () => {
    mockDb.reset();
    const user = await request(app).post('/api/auth/register').send({
      name: 'Owner User',
      email: 'owner@example.com',
      password: 'Password123!',
    });
    token = user.body.token;

    const project = await auth(request(app).post('/api/projects')).send({ name: 'Project' });
    projectId = project.body.id;

    const task = await auth(request(app).post(`/api/projects/${projectId}/tasks`)).send({ title: 'Task' });
    taskId = task.body.id;
  });

  describe('parseId', () => {
    it('accepts positive integers that fit a PostgreSQL INTEGER', () => {
      expect(parseId('1')).toBe(1);
      expect(parseId(42)).toBe(42);
      expect(parseId('2147483647')).toBe(2147483647);
    });

    it('rejects everything else', () => {
      ['0', '-1', '1.5', '1abc', 'abc', '', ' 1', '2147483648', '99999999999', null, undefined, {}].forEach((v) => {
        expect(parseId(v)).toBeNaN();
      });
    });
  });

  describe('ids in the URL', () => {
    it.each(['99999999999', '1abc', '0', '-5', '1.5'])('rejects project id "%s" with 400', async (id) => {
      const res = await auth(request(app).get(`/api/projects/${id}`));
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Invalid project ID', details: [] });
    });

    it('rejects an out-of-range task id with 400', async () => {
      const res = await auth(request(app).get('/api/tasks/99999999999'));
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid task ID');
    });

    it('rejects an out-of-range member id with 400', async () => {
      const res = await auth(request(app).delete(`/api/projects/${projectId}/members/99999999999`));
      expect(res.status).toBe(400);
    });
  });

  describe('projects', () => {
    it('rejects a non-text description on create', async () => {
      const res = await auth(request(app).post('/api/projects')).send({ name: 'P', description: 123 });
      expectFieldError(res, 'description');
    });

    it('rejects a non-text description on update', async () => {
      const res = await auth(request(app).put(`/api/projects/${projectId}`)).send({ name: 'P', description: ['x'] });
      expectFieldError(res, 'description');
    });
  });

  describe('tasks', () => {
    it('rejects a non-text description', async () => {
      const res = await auth(request(app).post(`/api/projects/${projectId}/tasks`)).send({ title: 'T', description: 5 });
      expectFieldError(res, 'description');
    });

    it('rejects a date that is not on the calendar', async () => {
      const res = await auth(request(app).post(`/api/projects/${projectId}/tasks`)).send({ title: 'T', due_date: '2026-02-31' });
      expectFieldError(res, 'due_date');
    });

    it('accepts a real leap day and rejects a fake one', async () => {
      const ok = await auth(request(app).post(`/api/projects/${projectId}/tasks`)).send({ title: 'T', due_date: '2028-02-29' });
      expect(ok.status).toBe(201);
      expect(ok.body.due_date).toBe('2028-02-29');

      const bad = await auth(request(app).post(`/api/projects/${projectId}/tasks`)).send({ title: 'T', due_date: '2027-02-29' });
      expectFieldError(bad, 'due_date');
    });

    it('rejects an assignee id that does not fit INTEGER', async () => {
      const res = await auth(request(app).post(`/api/projects/${projectId}/tasks`)).send({ title: 'T', assignee_id: 99999999999 });
      expectFieldError(res, 'assignee_id');
    });

    it('uses the defaults when status and priority are null on create', async () => {
      const res = await auth(request(app).post(`/api/projects/${projectId}/tasks`)).send({ title: 'T', status: null, priority: null });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('todo');
      expect(res.body.priority).toBe('medium');
    });

    it('rejects null status and priority on update', async () => {
      const status = await auth(request(app).put(`/api/tasks/${taskId}`)).send({ status: null });
      expectFieldError(status, 'status');

      const priority = await auth(request(app).put(`/api/tasks/${taskId}`)).send({ priority: null });
      expectFieldError(priority, 'priority');
    });

    it('rejects a non-text description on update', async () => {
      const res = await auth(request(app).put(`/api/tasks/${taskId}`)).send({ description: 7 });
      expectFieldError(res, 'description');
    });
  });

  describe('auth', () => {
    it('rejects a password longer than bcrypt can hash (72 bytes)', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Long',
        email: 'long@example.com',
        password: 'a'.repeat(73),
      });
      expectFieldError(res, 'password');
    });

    it('accepts a password of exactly 72 bytes', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Edge',
        email: 'edge@example.com',
        password: 'a'.repeat(72),
      });
      expect(res.status).toBe(201);
    });
  });

  describe('users search', () => {
    it('does not crash when search is repeated in the query string', async () => {
      const res = await auth(request(app).get('/api/users?search=a&search=b'));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('request body', () => {
    it('answers malformed JSON with 400 and a plain message', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{bad');
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Request body is not valid JSON', details: [] });
    });
  });

  describe('error handler', () => {
    function run(err) {
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      errorHandler(err, {}, res, () => {});
      return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
    }

    it('hides the message of an unexpected error', () => {
      const out = run(new Error('relation "users" does not exist at /srv/app/db.js'));
      expect(out).toEqual({ status: 500, body: { error: 'Internal server error', details: [] } });
    });

    it('keeps the message and details of an ApiError', () => {
      const { ApiError } = require('../server/utils/errors');
      const out = run(ApiError.badRequest('Nope', [{ field: 'x', message: 'y' }]));
      expect(out).toEqual({ status: 400, body: { error: 'Nope', details: [{ field: 'x', message: 'y' }] } });
    });

    it.each([
      ['23505', 409],
      ['23503', 400],
      ['23502', 400],
      ['22003', 400],
      ['22008', 400],
    ])('maps PostgreSQL error %s to %i without leaking SQL text', (code, status) => {
      const err = Object.assign(new Error('secret sql detail'), { code });
      const out = run(err);
      expect(out.status).toBe(status);
      expect(out.body.error).not.toMatch(/secret/);
    });
  });
});
