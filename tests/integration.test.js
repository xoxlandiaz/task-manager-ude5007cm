/*
 * Integration test: the real Express app against a real PostgreSQL.
 *
 * The other test files replace the database with tests/helpers/mockDb.js, so
 * they never execute our SQL. This file does: it checks the queries, the
 * constraints, the cascades and the updated_at trigger.
 *
 * It wipes every table, so it only runs when DATABASE_URL points at a database
 * whose name ends with "_test" (CI uses taskmanager_test) and the migrations
 * from db/migrations/ are applied. Anywhere else the whole suite is skipped.
 *
 *   DATABASE_URL=postgres://postgres:postgres@localhost:5432/taskmanager_test npm test
 */
const databaseUrl = process.env.DATABASE_URL || '';
const isTestDatabase = /\/[^/?]*_test(\?|$)/.test(databaseUrl);
const describeWithDb = isTestDatabase ? describe : describe.skip;

describeWithDb('API against a real PostgreSQL database', () => {
  const request = require('supertest');
  let app;
  let pool;

  const owner = { name: 'Olga Owner', email: 'olga@example.com', password: 'Password123!' };
  const member = { name: 'Mark Member', email: 'mark@example.com', password: 'Password123!' };
  const stranger = { name: 'Sam Stranger', email: 'sam@example.com', password: 'Password123!' };

  const as = (user, req) => req.set('Authorization', `Bearer ${user.token}`);

  async function register(user) {
    const res = await request(app).post('/api/auth/register').send(user);
    expect(res.status).toBe(201);
    user.token = res.body.token;
    user.id = res.body.user.id;
  }

  beforeAll(async () => {
    app = require('../server/app');
    pool = require('../server/db/pool');
    await pool.query('TRUNCATE comments, tasks, project_members, projects, users RESTART IDENTITY CASCADE');
    await register(owner);
    await register(member);
    await register(stranger);
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('auth', () => {
    it('stores the email in lower case and a bcrypt hash instead of the password', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Mixed Case',
        email: 'MiXeD@Example.COM',
        password: 'Password123!',
      });
      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe('mixed@example.com');

      const row = await pool.query('SELECT password_hash FROM users WHERE email = $1', ['mixed@example.com']);
      expect(row.rows[0].password_hash).toMatch(/^\$2[aby]\$\d{2}\$/);
      expect(row.rows[0].password_hash).not.toContain('Password123!');
    });

    it('refuses a second account with the same email in another case', async () => {
      const res = await request(app).post('/api/auth/register').send({ ...owner, email: 'OLGA@example.com' });
      expect(res.status).toBe(409);
    });

    it('logs in with the right password only', async () => {
      const ok = await request(app).post('/api/auth/login').send({ email: owner.email, password: owner.password });
      expect(ok.status).toBe(200);
      expect(ok.body.user).toEqual({ id: owner.id, name: owner.name, email: owner.email });

      const bad = await request(app).post('/api/auth/login').send({ email: owner.email, password: 'wrong-password' });
      expect(bad.status).toBe(401);
    });

    it('returns the current user for a valid token', async () => {
      const res = await as(owner, request(app).get('/api/auth/me'));
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ id: owner.id, email: owner.email });
      expect(res.body.user.password_hash).toBeUndefined();
    });
  });

  describe('project, members, tasks and comments', () => {
    let projectId;
    let taskId;
    let commentId;

    it('creates a project and makes the creator its owner in one transaction', async () => {
      const res = await as(owner, request(app).post('/api/projects')).send({ name: 'Coursework', description: 'Web Dev' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        name: 'Coursework',
        description: 'Web Dev',
        owner_id: owner.id,
        role: 'owner',
        task_count: 0,
        done_count: 0,
        member_count: 1,
      });
      projectId = res.body.id;

      const members = await pool.query('SELECT user_id, role FROM project_members WHERE project_id = $1', [projectId]);
      expect(members.rows).toEqual([{ user_id: owner.id, role: 'owner' }]);
    });

    it('shows a project only to its members', async () => {
      const mine = await as(owner, request(app).get('/api/projects'));
      expect(mine.body.map((p) => p.id)).toEqual([projectId]);

      const theirs = await as(stranger, request(app).get('/api/projects'));
      expect(theirs.body).toEqual([]);

      const direct = await as(stranger, request(app).get(`/api/projects/${projectId}`));
      expect(direct.status).toBe(403);

      const missing = await as(owner, request(app).get('/api/projects/999999'));
      expect(missing.status).toBe(404);
    });

    it('lets the owner add a member by email, once', async () => {
      const added = await as(owner, request(app).post(`/api/projects/${projectId}/members`)).send({ email: 'MARK@example.com' });
      expect(added.status).toBe(201);
      expect(added.body).toMatchObject({ project_id: projectId, user_id: member.id, role: 'member', name: member.name });

      const again = await as(owner, request(app).post(`/api/projects/${projectId}/members`)).send({ email: member.email });
      expect(again.status).toBe(409);

      const unknown = await as(owner, request(app).post(`/api/projects/${projectId}/members`)).send({ email: 'nobody@example.com' });
      expect(unknown.status).toBe(404);

      const byMember = await as(member, request(app).post(`/api/projects/${projectId}/members`)).send({ email: stranger.email });
      expect(byMember.status).toBe(403);

      const list = await as(member, request(app).get(`/api/projects/${projectId}/members`));
      expect(list.body.map((m) => [m.user_id, m.role])).toEqual([[owner.id, 'owner'], [member.id, 'member']]);
    });

    it('creates a task with joined names and a plain YYYY-MM-DD due date', async () => {
      const res = await as(owner, request(app).post(`/api/projects/${projectId}/tasks`)).send({
        title: 'Build the API',
        description: 'Express + pg',
        priority: 'high',
        assignee_id: member.id,
        due_date: '2026-12-01',
      });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        project_id: projectId,
        title: 'Build the API',
        description: 'Express + pg',
        status: 'todo',
        priority: 'high',
        assignee_id: member.id,
        assignee_name: member.name,
        created_by: owner.id,
        created_by_name: owner.name,
        due_date: '2026-12-01',
      });
      taskId = res.body.id;
    });

    it('only allows project members as assignees', async () => {
      const res = await as(owner, request(app).post(`/api/projects/${projectId}/tasks`)).send({
        title: 'Not allowed',
        assignee_id: stranger.id,
      });
      expect(res.status).toBe(400);
      expect(res.body.details).toEqual([{ field: 'assignee_id', message: 'Assignee must be a project member' }]);
    });

    it('updates part of a task and lets the trigger move updated_at', async () => {
      const before = await as(member, request(app).get(`/api/tasks/${taskId}`));
      const res = await as(member, request(app).put(`/api/tasks/${taskId}`)).send({ status: 'done', due_date: null });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'done', due_date: null, title: 'Build the API', priority: 'high' });
      expect(new Date(res.body.updated_at).getTime()).toBeGreaterThan(new Date(before.body.updated_at).getTime());
    });

    it('counts tasks and members on the project', async () => {
      await as(owner, request(app).post(`/api/projects/${projectId}/tasks`)).send({ title: 'Second task' });
      const res = await as(member, request(app).get(`/api/projects/${projectId}`));
      expect(res.body).toMatchObject({ role: 'member', task_count: 2, done_count: 1, member_count: 2 });

      const tasks = await as(member, request(app).get(`/api/projects/${projectId}/tasks`));
      expect(tasks.body.map((t) => t.title)).toEqual(['Build the API', 'Second task']);
    });

    it('hides tasks and comments from non-members', async () => {
      expect((await as(stranger, request(app).get(`/api/tasks/${taskId}`))).status).toBe(403);
      expect((await as(stranger, request(app).put(`/api/tasks/${taskId}`)).send({ status: 'todo' })).status).toBe(403);
      expect((await as(stranger, request(app).delete(`/api/tasks/${taskId}`))).status).toBe(403);
      expect((await as(stranger, request(app).get(`/api/tasks/${taskId}/comments`))).status).toBe(403);
      expect((await as(stranger, request(app).post(`/api/tasks/${taskId}/comments`)).send({ body: 'hi' })).status).toBe(403);
    });

    it('adds and lists comments with the author name', async () => {
      const created = await as(member, request(app).post(`/api/tasks/${taskId}/comments`)).send({ body: '  Done, please review  ' });
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ task_id: taskId, user_id: member.id, body: 'Done, please review', author_name: member.name });
      commentId = created.body.id;

      const list = await as(owner, request(app).get(`/api/tasks/${taskId}/comments`));
      expect(list.body.map((c) => c.id)).toEqual([commentId]);
    });

    it('lets only the author or the project owner delete a comment', async () => {
      expect((await as(stranger, request(app).delete(`/api/comments/${commentId}`))).status).toBe(403);
      expect((await as(owner, request(app).delete(`/api/comments/${commentId}`))).status).toBe(204);
      expect((await as(owner, request(app).delete(`/api/comments/${commentId}`))).status).toBe(404);
    });

    it('unassigns the tasks of a removed member and revokes their access', async () => {
      await as(owner, request(app).put(`/api/tasks/${taskId}`)).send({ assignee_id: member.id });

      const self = await as(owner, request(app).delete(`/api/projects/${projectId}/members/${owner.id}`));
      expect(self.status).toBe(400);

      const removed = await as(owner, request(app).delete(`/api/projects/${projectId}/members/${member.id}`));
      expect(removed.status).toBe(204);

      const task = await as(owner, request(app).get(`/api/tasks/${taskId}`));
      expect(task.body).toMatchObject({ assignee_id: null, assignee_name: null });

      expect((await as(member, request(app).get(`/api/projects/${projectId}`))).status).toBe(403);
    });

    it('lets only the owner rename and delete the project; delete cascades', async () => {
      await as(owner, request(app).post(`/api/projects/${projectId}/members`)).send({ email: member.email });
      await as(member, request(app).post(`/api/tasks/${taskId}/comments`)).send({ body: 'Will be cascaded' });

      expect((await as(member, request(app).put(`/api/projects/${projectId}`)).send({ name: 'Hack' })).status).toBe(403);
      expect((await as(member, request(app).delete(`/api/projects/${projectId}`))).status).toBe(403);

      const renamed = await as(owner, request(app).put(`/api/projects/${projectId}`)).send({ name: 'Renamed', description: '' });
      expect(renamed.body).toMatchObject({ name: 'Renamed', description: null, task_count: 2, member_count: 2 });

      expect((await as(owner, request(app).delete(`/api/projects/${projectId}`))).status).toBe(204);

      const left = await pool.query(
        `SELECT (SELECT COUNT(*)::int FROM tasks) AS tasks,
                (SELECT COUNT(*)::int FROM comments) AS comments,
                (SELECT COUNT(*)::int FROM project_members) AS members`
      );
      expect(left.rows[0]).toEqual({ tasks: 0, comments: 0, members: 0 });
      expect((await as(owner, request(app).get(`/api/tasks/${taskId}`))).status).toBe(404);
    });
  });

  describe('users', () => {
    it('searches by name or email without exposing password hashes', async () => {
      const res = await as(owner, request(app).get('/api/users?search=MARK'));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({ id: member.id, name: member.name, email: member.email });
      expect(res.body[0].password_hash).toBeUndefined();
    });
  });
});
