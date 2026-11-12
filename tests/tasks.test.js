jest.mock('../server/db/pool', () => require('./helpers/mockDb'));

const request = require('supertest');
const app = require('../server/app');
const mockDb = require('./helpers/mockDb');

describe('Tasks API (/api/tasks and /api/projects/:id/tasks)', () => {
  let ownerToken;
  let memberToken;
  let strangerToken;
  let memberUser;
  let projectId;

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
    memberUser = u2.body.user;

    const u3 = await request(app).post('/api/auth/register').send({
      name: 'Stranger User',
      email: 'stranger@example.com',
      password: 'Password123!',
    });
    strangerToken = u3.body.token;

    const p = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Task Board Project' });
    projectId = p.body.id;

    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'member@example.com' });
  });

  describe('POST /api/projects/:id/tasks', () => {
    it('should validate title and return 400 with details array', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
      expect(Array.isArray(res.body.details)).toBe(true);
      expect(res.body.details[0].field).toBe('title');
    });

    it('should reject assignee who is not a project member with 400', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Invalid Assignee Task',
          assignee_id: 9999,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
      expect(Array.isArray(res.body.details)).toBe(true);
      expect(res.body.details[0].field).toBe('assignee_id');
    });

    it('should forbid non-members with 403', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .send({ title: 'Unauthorized Task' });

      expect(res.status).toBe(403);
      expect(Array.isArray(res.body.details)).toBe(true);
    });

    it('should create task and return computed assignee_name and created_by_name', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Implement Auth',
          description: 'JWT middleware and bcrypt',
          status: 'todo',
          priority: 'high',
          due_date: '2026-12-01',
          assignee_id: memberUser.id,
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        title: 'Implement Auth',
        description: 'JWT middleware and bcrypt',
        status: 'todo',
        priority: 'high',
        due_date: '2026-12-01',
        assignee_id: memberUser.id,
        assignee_name: 'Member User',
        created_by_name: 'Owner User',
      });
    });
  });

  describe('GET /api/projects/:id/tasks and GET /api/tasks/:id', () => {
    let taskId;

    beforeEach(async () => {
      const created = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Existing Task',
          priority: 'medium',
        });
      taskId = created.body.id;
    });

    it('GET /api/projects/:id/tasks should list tasks with joined names', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].title).toBe('Existing Task');
      expect(res.body[0].created_by_name).toBe('Owner User');
    });

    it('GET /api/tasks/:id should return 404 for non-existent task', async () => {
      const res = await request(app)
        .get('/api/tasks/99999')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(404);
      expect(Array.isArray(res.body.details)).toBe(true);
    });

    it('GET /api/tasks/:id should return 403 for user not member of project', async () => {
      const res = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${strangerToken}`);

      expect(res.status).toBe(403);
      expect(Array.isArray(res.body.details)).toBe(true);
    });

    it('GET /api/tasks/:id should return 200 with task for project member', async () => {
      const res = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(taskId);
      expect(res.body.title).toBe('Existing Task');
    });
  });

  describe('PUT /api/tasks/:id (Partial updates)', () => {
    let taskId;

    beforeEach(async () => {
      const created = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Initial Title',
          description: 'Initial Description',
          status: 'todo',
          priority: 'low',
        });
      taskId = created.body.id;
    });

    it('should support partial update for status only (e.g. moving card on kanban)', async () => {
      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ status: 'in_progress' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('in_progress');
      expect(res.body.title).toBe('Initial Title');
    });

    it('should support partial update for assignee and priority', async () => {
      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          priority: 'high',
          assignee_id: memberUser.id,
        });

      expect(res.status).toBe(200);
      expect(res.body.priority).toBe('high');
      expect(res.body.assignee_id).toBe(memberUser.id);
      expect(res.body.assignee_name).toBe('Member User');
    });

    it('should support partial update for unassigning (assignee_id: null)', async () => {
      // First assign
      await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ assignee_id: memberUser.id });

      // Then unassign
      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ assignee_id: null });

      expect(res.status).toBe(200);
      expect(res.body.assignee_id).toBeNull();
      expect(res.body.assignee_name).toBeNull();
    });

    it('should return 400 when updating with empty body', async () => {
      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(Array.isArray(res.body.details)).toBe(true);
    });

    it('should return 400 when invalid status is provided', async () => {
      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'invalid_status' });

      expect(res.status).toBe(400);
      expect(Array.isArray(res.body.details)).toBe(true);
      expect(res.body.details[0].field).toBe('status');
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    let taskId;

    beforeEach(async () => {
      const created = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'Task To Delete' });
      taskId = created.body.id;
    });

    it('should forbid non-members with 403', async () => {
      const res = await request(app)
        .delete(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${strangerToken}`);

      expect(res.status).toBe(403);
      expect(Array.isArray(res.body.details)).toBe(true);
    });

    it('should delete task and return 204 for project member', async () => {
      const res = await request(app)
        .delete(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(204);

      const check = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${memberToken}`);
      expect(check.status).toBe(404);
    });
  });
});
