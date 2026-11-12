jest.mock('../server/db/pool', () => require('./helpers/mockDb'));

const request = require('supertest');
const app = require('../server/app');
const mockDb = require('./helpers/mockDb');

describe('Comments API (/api/tasks/:id/comments and /api/comments/:id)', () => {
  let ownerToken;
  let memberToken;
  let strangerToken;
  let projectId;
  let taskId;

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

    const p = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Discussion Project' });
    projectId = p.body.id;

    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'member@example.com' });

    const t = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Task with Comments' });
    taskId = t.body.id;
  });

  describe('POST /api/tasks/:id/comments', () => {
    it('should validate comment body and return 400 on empty body', async () => {
      const res = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ body: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
      expect(Array.isArray(res.body.details)).toBe(true);
      expect(res.body.details[0].field).toBe('body');
    });

    it('should forbid non-members with 403', async () => {
      const res = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .send({ body: 'Sneaky comment' });

      expect(res.status).toBe(403);
      expect(Array.isArray(res.body.details)).toBe(true);
    });

    it('should create comment and return author_name (JOIN users)', async () => {
      const res = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ body: 'Looks good! Working on it.' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        task_id: taskId,
        body: 'Looks good! Working on it.',
        author_name: 'Member User',
      });
    });
  });

  describe('GET /api/tasks/:id/comments', () => {
    beforeEach(async () => {
      await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ body: 'First comment' });
    });

    it('should list comments with author_name for project members', async () => {
      const res = await request(app)
        .get(`/api/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].body).toBe('First comment');
      expect(res.body[0].author_name).toBe('Member User');
    });

    it('should forbid non-members with 403', async () => {
      const res = await request(app)
        .get(`/api/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${strangerToken}`);

      expect(res.status).toBe(403);
      expect(Array.isArray(res.body.details)).toBe(true);
    });
  });

  describe('DELETE /api/comments/:id', () => {
    let commentId;

    beforeEach(async () => {
      const created = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ body: 'Comment to delete' });
      commentId = created.body.id;
    });

    it('should forbid strangers or unauthorized members with 403', async () => {
      const res = await request(app)
        .delete(`/api/comments/${commentId}`)
        .set('Authorization', `Bearer ${strangerToken}`);

      expect(res.status).toBe(403);
      expect(Array.isArray(res.body.details)).toBe(true);
    });

    it('should allow the comment author to delete their comment', async () => {
      const res = await request(app)
        .delete(`/api/comments/${commentId}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(204);

      const list = await request(app)
        .get(`/api/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(list.body.length).toBe(0);
    });

    it('should allow the project owner to delete any comment', async () => {
      const res = await request(app)
        .delete(`/api/comments/${commentId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(204);
    });
  });
});
