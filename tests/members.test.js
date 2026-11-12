jest.mock('../server/db/pool', () => require('./helpers/mockDb'));

const request = require('supertest');
const app = require('../server/app');
const mockDb = require('./helpers/mockDb');

describe('Project Members API (/api/projects/:id/members)', () => {
  let ownerToken;
  let memberToken;
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
      name: 'Colleague User',
      email: 'colleague@example.com',
      password: 'Password123!',
    });
    memberToken = u2.body.token;
    memberUser = u2.body.user;

    const p = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Team Project' });
    projectId = p.body.id;
  });

  describe('GET /api/projects/:id/members', () => {
    it('should return list of members including owner', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0]).toMatchObject({
        role: 'owner',
        name: 'Owner User',
        email: 'owner@example.com',
      });
    });
  });

  describe('POST /api/projects/:id/members', () => {
    it('should forbid non-owners with 403', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ email: 'somebody@example.com' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Only the project owner can add members.');
      expect(Array.isArray(res.body.details)).toBe(true);
    });

    it('should return 404 when user email does not exist', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: 'nonexistent@example.com' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('No TaskFlow account uses this email.');
      expect(Array.isArray(res.body.details)).toBe(true);
    });

    it('should add member successfully with 201', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: 'colleague@example.com' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        project_id: projectId,
        user_id: memberUser.id,
        role: 'member',
        name: 'Colleague User',
        email: 'colleague@example.com',
      });
    });

    it('should return 409 when user is already a member', async () => {
      await request(app)
        .post(`/api/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: 'colleague@example.com' });

      const res = await request(app)
        .post(`/api/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: 'colleague@example.com' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('User is already a member of this project.');
      expect(Array.isArray(res.body.details)).toBe(true);
    });
  });

  describe('DELETE /api/projects/:id/members/:userId', () => {
    beforeEach(async () => {
      await request(app)
        .post(`/api/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: 'colleague@example.com' });
    });

    it('should forbid non-owner from removing members', async () => {
      const res = await request(app)
        .delete(`/api/projects/${projectId}/members/${memberUser.id}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
      expect(Array.isArray(res.body.details)).toBe(true);
    });

    it('should return 400 when trying to remove the owner', async () => {
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${ownerToken}`);
      const ownerId = meRes.body.user.id;

      const res = await request(app)
        .delete(`/api/projects/${projectId}/members/${ownerId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Cannot remove owner from project.');
      expect(Array.isArray(res.body.details)).toBe(true);
    });

    it('should remove member and unassign their tasks in the project', async () => {
      // Create a task assigned to the colleague
      const taskRes = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Colleague Task',
          assignee_id: memberUser.id,
        });

      const taskId = taskRes.body.id;
      expect(taskRes.body.assignee_id).toBe(memberUser.id);
      expect(taskRes.body.assignee_name).toBe('Colleague User');

      // Remove colleague from project
      const delRes = await request(app)
        .delete(`/api/projects/${projectId}/members/${memberUser.id}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(delRes.status).toBe(204);

      // Verify task was unassigned (assignee_id is now null)
      const taskCheck = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(taskCheck.status).toBe(200);
      expect(taskCheck.body.assignee_id).toBeNull();
      expect(taskCheck.body.assignee_name).toBeNull();
    });
  });
});
