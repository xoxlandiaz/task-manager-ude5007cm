// In-memory mock database for Jest + Supertest tests without PostgreSQL
class MockDb {
  constructor() {
    this.reset();
  }

  reset() {
    this.users = [];
    this.projects = [];
    this.projectMembers = [];
    this.tasks = [];
    this.comments = [];
    this.nextUserId = 1;
    this.nextProjectId = 1;
    this.nextTaskId = 1;
    this.nextCommentId = 1;
  }

  async query(sql, params = []) {
    const text = sql.replace(/\s+/g, ' ').trim();

    // Transactions
    if (/^(BEGIN|COMMIT|ROLLBACK)/i.test(text)) {
      return { rows: [], rowCount: 0 };
    }

    // --- USERS ---
    // SELECT id FROM users WHERE email = $1
    // SELECT id, name, email, password_hash FROM users WHERE email = $1
    // SELECT id, name, email, created_at FROM users WHERE id = $1
    if (/SELECT .* FROM users WHERE email = \$1/i.test(text)) {
      const email = (params[0] || '').toLowerCase();
      const user = this.users.find((u) => u.email.toLowerCase() === email);
      return { rows: user ? [{ ...user }] : [], rowCount: user ? 1 : 0 };
    }

    if (/SELECT .* FROM users WHERE id = \$1/i.test(text)) {
      const id = Number(params[0]);
      const user = this.users.find((u) => u.id === id);
      return { rows: user ? [{ ...user }] : [], rowCount: user ? 1 : 0 };
    }

    if (/SELECT .* FROM users WHERE lower\(name\) LIKE \$1/i.test(text)) {
      const term = (params[0] || '').replace(/%/g, '').toLowerCase();
      const rows = this.users.filter(
        (u) => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)
      );
      return { rows: rows.map((u) => ({ id: u.id, name: u.name, email: u.email, created_at: u.created_at })), rowCount: rows.length };
    }

    if (/SELECT .* FROM users ORDER BY name ASC/i.test(text)) {
      const rows = [...this.users]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((u) => ({ id: u.id, name: u.name, email: u.email, created_at: u.created_at }));
      return { rows, rowCount: rows.length };
    }

    if (/INSERT INTO users/i.test(text)) {
      const [name, email, password_hash] = params;
      const user = {
        id: this.nextUserId++,
        name,
        email: email.toLowerCase(),
        password_hash,
        created_at: new Date().toISOString(),
      };
      this.users.push(user);
      return { rows: [{ id: user.id, name: user.name, email: user.email, created_at: user.created_at }], rowCount: 1 };
    }

    // --- PROJECTS ---
    // List projects for user with computed counts
    if (/SELECT .* FROM projects p JOIN project_members pm ON pm\.project_id = p\.id AND pm\.user_id = \$1/i.test(text)) {
      const userId = Number(params[0]);
      const userMemberships = this.projectMembers.filter((pm) => pm.user_id === userId);
      const rows = userMemberships.map((pm) => {
        const p = this.projects.find((pr) => pr.id === pm.project_id);
        const tasks = this.tasks.filter((t) => t.project_id === p.id);
        const doneTasks = tasks.filter((t) => t.status === 'done');
        const members = this.projectMembers.filter((m) => m.project_id === p.id);
        return {
          id: p.id,
          name: p.name,
          description: p.description,
          owner_id: p.owner_id,
          created_at: p.created_at,
          updated_at: p.updated_at,
          role: pm.role,
          task_count: tasks.length,
          done_count: doneTasks.length,
          member_count: members.length,
        };
      });
      return { rows, rowCount: rows.length };
    }

    // Single project for user with computed counts
    if (/SELECT .* FROM projects p JOIN project_members pm ON pm\.project_id = p\.id AND pm\.user_id = \$2 WHERE p\.id = \$1/i.test(text)) {
      const projectId = Number(params[0]);
      const userId = Number(params[1]);
      const pm = this.projectMembers.find((m) => m.project_id === projectId && m.user_id === userId);
      const p = this.projects.find((pr) => pr.id === projectId);
      if (!p || !pm) return { rows: [], rowCount: 0 };

      const tasks = this.tasks.filter((t) => t.project_id === p.id);
      const doneTasks = tasks.filter((t) => t.status === 'done');
      const members = this.projectMembers.filter((m) => m.project_id === p.id);

      return {
        rows: [{
          id: p.id,
          name: p.name,
          description: p.description,
          owner_id: p.owner_id,
          created_at: p.created_at,
          updated_at: p.updated_at,
          role: pm.role,
          task_count: tasks.length,
          done_count: doneTasks.length,
          member_count: members.length,
        }],
        rowCount: 1,
      };
    }

    // Project counts query
    if (/SELECT \(SELECT COUNT\(\*\)::int FROM tasks t WHERE t\.project_id = \$1\) AS task_count/i.test(text)) {
      const projectId = Number(params[0]);
      const tasks = this.tasks.filter((t) => t.project_id === projectId);
      const doneTasks = tasks.filter((t) => t.status === 'done');
      const members = this.projectMembers.filter((m) => m.project_id === projectId);
      return {
        rows: [{
          task_count: tasks.length,
          done_count: doneTasks.length,
          member_count: members.length,
        }],
        rowCount: 1,
      };
    }

    // Check project exists
    if (/SELECT id FROM projects WHERE id = \$1/i.test(text) || /SELECT \* FROM projects WHERE id = \$1/i.test(text)) {
      const id = Number(params[0]);
      const p = this.projects.find((pr) => pr.id === id);
      return { rows: p ? [{ ...p }] : [], rowCount: p ? 1 : 0 };
    }

    // Insert project
    if (/INSERT INTO projects/i.test(text)) {
      const [owner_id, name, description] = params;
      const now = new Date().toISOString();
      const project = {
        id: this.nextProjectId++,
        owner_id: Number(owner_id),
        name,
        description: description || null,
        created_at: now,
        updated_at: now,
      };
      this.projects.push(project);
      return { rows: [{ ...project }], rowCount: 1 };
    }

    // Update project
    if (/UPDATE projects SET/i.test(text)) {
      const now = new Date().toISOString();
      if (params.length === 3) {
        const [name, description, id] = params;
        const p = this.projects.find((pr) => pr.id === Number(id));
        if (p) {
          p.name = name;
          p.description = description;
          p.updated_at = now;
          return { rows: [{ ...p }], rowCount: 1 };
        }
      } else {
        const [name, id] = params;
        const p = this.projects.find((pr) => pr.id === Number(id));
        if (p) {
          p.name = name;
          p.updated_at = now;
          return { rows: [{ ...p }], rowCount: 1 };
        }
      }
      return { rows: [], rowCount: 0 };
    }

    // Delete project
    if (/DELETE FROM projects WHERE id = \$1/i.test(text)) {
      const id = Number(params[0]);
      this.projects = this.projects.filter((p) => p.id !== id);
      this.projectMembers = this.projectMembers.filter((pm) => pm.project_id !== id);
      this.tasks = this.tasks.filter((t) => t.project_id !== id);
      return { rows: [], rowCount: 1 };
    }

    // --- PROJECT MEMBERS ---
    // Member check: SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2
    if (/SELECT role FROM project_members WHERE project_id = \$1 AND user_id = \$2/i.test(text)) {
      const projectId = Number(params[0]);
      const userId = Number(params[1]);
      const pm = this.projectMembers.find((m) => m.project_id === projectId && m.user_id === userId);
      return { rows: pm ? [{ role: pm.role }] : [], rowCount: pm ? 1 : 0 };
    }

    if (/SELECT 1 FROM project_members WHERE project_id = \$1 AND user_id = \$2/i.test(text)) {
      const projectId = Number(params[0]);
      const userId = Number(params[1]);
      const pm = this.projectMembers.find((m) => m.project_id === projectId && m.user_id === userId);
      return { rows: pm ? [{ '?column?': 1 }] : [], rowCount: pm ? 1 : 0 };
    }

    // List members: SELECT ... FROM project_members pm JOIN users u ...
    if (/SELECT .* FROM project_members pm JOIN users u ON u\.id = pm\.user_id WHERE pm\.project_id = \$1/i.test(text)) {
      const projectId = Number(params[0]);
      const members = this.projectMembers
        .filter((pm) => pm.project_id === projectId)
        .map((pm) => {
          const user = this.users.find((u) => u.id === pm.user_id) || {};
          return {
            project_id: pm.project_id,
            user_id: pm.user_id,
            role: pm.role,
            joined_at: pm.joined_at,
            name: user.name,
            email: user.email,
          };
        });
      return { rows: members, rowCount: members.length };
    }

    // Insert project member
    if (/INSERT INTO project_members/i.test(text)) {
      let role = params[2];
      if (!role) {
        if (/'owner'/i.test(text)) role = 'owner';
        else role = 'member';
      }
      const [project_id, user_id] = params;
      const joined_at = new Date().toISOString();
      const member = {
        project_id: Number(project_id),
        user_id: Number(user_id),
        role: role || 'member',
        joined_at,
      };
      this.projectMembers.push(member);
      return { rows: [{ ...member }], rowCount: 1 };
    }

    // Delete project member
    if (/DELETE FROM project_members WHERE project_id = \$1 AND user_id = \$2/i.test(text)) {
      const projectId = Number(params[0]);
      const userId = Number(params[1]);
      const prevLen = this.projectMembers.length;
      this.projectMembers = this.projectMembers.filter(
        (m) => !(m.project_id === projectId && m.user_id === userId)
      );
      return { rows: [], rowCount: prevLen - this.projectMembers.length };
    }

    // Unassign tasks on member removal
    if (/UPDATE tasks SET assignee_id = NULL WHERE project_id = \$1 AND assignee_id = \$2/i.test(text)) {
      const projectId = Number(params[0]);
      const userId = Number(params[1]);
      let count = 0;
      this.tasks.forEach((t) => {
        if (t.project_id === projectId && t.assignee_id === userId) {
          t.assignee_id = null;
          count++;
        }
      });
      return { rows: [], rowCount: count };
    }

    // --- TASKS ---
    // List project tasks
    if (/SELECT .* FROM tasks t LEFT JOIN users u ON u\.id = t\.assignee_id LEFT JOIN users c ON c\.id = t\.created_by WHERE t\.project_id = \$1/i.test(text)) {
      const projectId = Number(params[0]);
      const rows = this.tasks
        .filter((t) => t.project_id === projectId)
        .map((t) => {
          const assignee = this.users.find((u) => u.id === t.assignee_id);
          const creator = this.users.find((u) => u.id === t.created_by);
          return {
            ...t,
            assignee_name: assignee ? assignee.name : null,
            created_by_name: creator ? creator.name : null,
          };
        });
      return { rows, rowCount: rows.length };
    }

    // Single task with joins
    if (/SELECT .* FROM tasks t LEFT JOIN users u ON u\.id = t\.assignee_id LEFT JOIN users c ON c\.id = t\.created_by WHERE t\.id = \$1/i.test(text)) {
      const taskId = Number(params[0]);
      const t = this.tasks.find((task) => task.id === taskId);
      if (!t) return { rows: [], rowCount: 0 };
      const assignee = this.users.find((u) => u.id === t.assignee_id);
      const creator = this.users.find((u) => u.id === t.created_by);
      return {
        rows: [{
          ...t,
          assignee_name: assignee ? assignee.name : null,
          created_by_name: creator ? creator.name : null,
        }],
        rowCount: 1,
      };
    }

    // Check task existence
    if (/SELECT project_id, assignee_id FROM tasks WHERE id = \$1/i.test(text) || /SELECT project_id FROM tasks WHERE id = \$1/i.test(text)) {
      const taskId = Number(params[0]);
      const t = this.tasks.find((task) => task.id === taskId);
      return { rows: t ? [{ project_id: t.project_id, assignee_id: t.assignee_id }] : [], rowCount: t ? 1 : 0 };
    }

    // Insert task
    if (/INSERT INTO tasks/i.test(text)) {
      const [project_id, assignee_id, created_by, title, description, status, priority, due_date] = params;
      const now = new Date().toISOString();
      const task = {
        id: this.nextTaskId++,
        project_id: Number(project_id),
        assignee_id: assignee_id ? Number(assignee_id) : null,
        created_by: Number(created_by),
        title,
        description: description || null,
        status: status || 'todo',
        priority: priority || 'medium',
        due_date: due_date || null,
        created_at: now,
        updated_at: now,
      };
      this.tasks.push(task);
      return { rows: [{ id: task.id }], rowCount: 1 };
    }

    // Update task
    if (/UPDATE tasks SET .* WHERE id = \$\d+/i.test(text)) {
      const taskId = Number(params[params.length - 1]);
      const task = this.tasks.find((t) => t.id === taskId);
      if (task) {
        const setPart = text.match(/SET (.*) WHERE id/i)[1];
        const assignments = setPart.split(',').map((s) => s.trim());
        assignments.forEach((assignment) => {
          const [col, paramPlaceholder] = assignment.split('=').map((s) => s.trim());
          const pIndex = Number(paramPlaceholder.replace('$', '')) - 1;
          const val = params[pIndex];
          if (col === 'title') task.title = val;
          if (col === 'description') task.description = val;
          if (col === 'status') task.status = val;
          if (col === 'priority') task.priority = val;
          if (col === 'assignee_id') task.assignee_id = val ? Number(val) : null;
          if (col === 'due_date') task.due_date = val || null;
        });
        task.updated_at = new Date().toISOString();
        return { rows: [{ ...task }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // Delete task
    if (/DELETE FROM tasks WHERE id = \$1/i.test(text)) {
      const id = Number(params[0]);
      this.tasks = this.tasks.filter((t) => t.id !== id);
      this.comments = this.comments.filter((c) => c.task_id !== id);
      return { rows: [], rowCount: 1 };
    }

    // --- COMMENTS ---
    // List comments
    if (/SELECT .* FROM comments c JOIN users u ON u\.id = c\.user_id WHERE c\.task_id = \$1/i.test(text)) {
      const taskId = Number(params[0]);
      const rows = this.comments
        .filter((c) => c.task_id === taskId)
        .map((c) => {
          const user = this.users.find((u) => u.id === c.user_id) || {};
          return {
            ...c,
            author_name: user.name,
            author_email: user.email,
          };
        });
      return { rows, rowCount: rows.length };
    }

    // Single comment
    if (/SELECT .* FROM comments c JOIN users u ON u\.id = c\.user_id WHERE c\.id = \$1/i.test(text)) {
      const commentId = Number(params[0]);
      const c = this.comments.find((comm) => comm.id === commentId);
      if (!c) return { rows: [], rowCount: 0 };
      const user = this.users.find((u) => u.id === c.user_id) || {};
      return {
        rows: [{
          ...c,
          author_name: user.name,
          author_email: user.email,
        }],
        rowCount: 1,
      };
    }

    // Check comment authorization
    if (/SELECT c\.id, c\.user_id, t\.project_id, p\.owner_id FROM comments c JOIN tasks t ON t\.id = c\.task_id JOIN projects p ON p\.id = t\.project_id WHERE c\.id = \$1/i.test(text)) {
      const commentId = Number(params[0]);
      const c = this.comments.find((comm) => comm.id === commentId);
      if (!c) return { rows: [], rowCount: 0 };
      const t = this.tasks.find((task) => task.id === c.task_id);
      const p = t ? this.projects.find((proj) => proj.id === t.project_id) : null;
      return {
        rows: [{
          id: c.id,
          user_id: c.user_id,
          project_id: t ? t.project_id : null,
          owner_id: p ? p.owner_id : null,
        }],
        rowCount: 1,
      };
    }

    // Insert comment
    if (/INSERT INTO comments/i.test(text)) {
      const [task_id, user_id, body] = params;
      const now = new Date().toISOString();
      const comment = {
        id: this.nextCommentId++,
        task_id: Number(task_id),
        user_id: Number(user_id),
        body,
        created_at: now,
      };
      this.comments.push(comment);
      return { rows: [{ id: comment.id }], rowCount: 1 };
    }

    // Delete comment
    if (/DELETE FROM comments WHERE id = \$1/i.test(text)) {
      const id = Number(params[0]);
      this.comments = this.comments.filter((c) => c.id !== id);
      return { rows: [], rowCount: 1 };
    }

    console.warn('Unhandled SQL query in mockDb:', text, params);
    return { rows: [], rowCount: 0 };
  }

  async connect() {
    return {
      query: (sql, params) => this.query(sql, params),
      release: () => {},
    };
  }
}

const mockDb = new MockDb();

module.exports = mockDb;
