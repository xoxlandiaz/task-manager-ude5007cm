jest.mock('../server/db/pool', () => require('./helpers/mockDb'));

const request = require('supertest');
const app = require('../server/app');
const mockDb = require('./helpers/mockDb');

describe('Projects API (/api/projects)', () => {
  let ownerToken;
  let memberToken;
  let strangerToken;

  beforeEach(async () => {
    mockDb.reset();

    const u1 = await request(app).post('/api/auth/register').send({
      name: 'Owner User',
      email: 'owner@example.com',
      password: 'Password123!',
    });
    ownerToken = u1.body.token;

    const u2 = await request(app).post('/api/auth/register').send({
      name: 'Member User',
      email: 'member@example.com',
      password: 'Password123!',
    });
    memberToken = u2.body.token;

    const u3 = await request(app).post('/api/auth/register').send({
      name: 'Stranger User',
      email: 'stranger@example.com',
      password: 'Password123!',
    });
    strangerToken = u3.body.token;
  });

  describe('POST /api/projects', () => {
    it('should return 401 when no token is provided', async () => {
      const res = await request(app).post('/api/projects').send({ name: 'New Project' });
      expect(res.status).toBe(401);
      expect(Array.isArray(res.body.details)).toBe(true);
    });

    it('should validate project name and return 400 with details array', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
      expect(Array.isArray(res.body.details)).toBe(true);
      expect(res.body.details[0].field).toBe('name');
    });

    it('should create project, assign owner, and return computed fields', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Coursework Project', description: 'Web Dev module' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(Number),
        name: 'Coursework Project',
        description: 'Web Dev module',
        role: 'owner',
        task_count: 0,
        done_count: 0,
        member_count: 1,
      });
    });
  });

  describe('GET /api/projects and GET /api/projects/:id', () => {
    let projectId;

    beforeEach(async () => {
      const created = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Main Project', description: 'Core project' });
      projectId = created.body.id;

      // Add member
      await request(app)
        .post(`/api/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: 'member@example.com' });
    });

    it('GET /api/projects should list projects with role, task_count, done_count, member_count', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0]).toMatchObject({
        id: projectId,
        name: 'Main Project',
        role: 'owner',
        member_count: 2,
      });
    });

    it('GET /api/projects/:id should return 404 for non-existent project', async () => {
      const res = await request(app)
        .get('/api/projects/9999')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(404);
      expect(Array.isArray(res.body.details)).toBe(true);
    });

    it('GET /api/projects/:id should return 403 for non-member user', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${strangerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('You are not a member of this project.');
      expect(Array.isArray(res.body.details)).toBe(true);
    });

    it('GET /api/projects/:id should return 200 with project details for member', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: projectId,
        name: 'Main Project',
        role: 'member',
        member_count: 2,
      });
    });
  });

  describe('PUT and DELETE /api/projects/:id', () => {
    let projectId;

    beforeEach(async () => {
      const created = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Editable Project' });
      projectId = created.body.id;

      await request(app)
        .post(`/api/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: 'member@example.com' });
    });

    it('PUT /api/projects/:id should forbid non-owners with 403', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'Hacked name' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Only the project owner can update this project.');
      expect(Array.isArray(res.body.details)).toBe(true);
    });

    it('PUT /api/projects/:id should allow owner to update project', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Updated Name', description: 'Updated Desc' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Name');
      expect(res.body.description).toBe('Updated Desc');
      expect(res.body.role).toBe('owner');
    });

    it('DELETE /api/projects/:id should forbid non-owners with 403', async () => {
      const res = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Only the project owner can delete this project.');
      expect(Array.isArray(res.body.details)).toBe(true);
    });

    it('DELETE /api/projects/:id should allow owner to delete project', async () => {
      const res = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(204);

      const check = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(check.status).toBe(404);
    });
  });
});
