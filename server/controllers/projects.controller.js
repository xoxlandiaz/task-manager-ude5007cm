const pool = require('../db/pool');
const { parseId } = require('../utils/ids');

async function listProjects(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT 
        p.id,
        p.name,
        p.description,
        p.owner_id,
        p.created_at,
        p.updated_at,
        pm.role,
        (SELECT COUNT(*)::int FROM tasks t WHERE t.project_id = p.id) AS task_count,
        (SELECT COUNT(*)::int FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS done_count,
        (SELECT COUNT(*)::int FROM project_members pm2 WHERE pm2.project_id = p.id) AS member_count
      FROM projects p
      JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
      ORDER BY p.updated_at DESC`,
      [req.user.id]
    );

    return res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

async function createProject(req, res, next) {
  const client = await pool.connect();
  try {
    const name = req.body.name.trim();
    const description = req.body.description && req.body.description.trim()
      ? req.body.description.trim()
      : null;

    await client.query('BEGIN');

    const projectResult = await client.query(
      `INSERT INTO projects (owner_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING id, owner_id, name, description, created_at, updated_at`,
      [req.user.id, name, description]
    );

    const project = projectResult.rows[0];

    await client.query(
      `INSERT INTO project_members (project_id, user_id, role)
       VALUES ($1, $2, $3)`,
      [project.id, req.user.id, 'owner']
    );

    await client.query('COMMIT');

    return res.status(201).json({
      ...project,
      role: 'owner',
      task_count: 0,
      done_count: 0,
      member_count: 1,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

async function getProject(req, res, next) {
  try {
    const projectId = parseId(req.params.id);
    if (isNaN(projectId) || projectId <= 0) {
      return res.status(400).json({
        error: 'Invalid project ID',
        details: [],
      });
    }

    const checkProject = await pool.query('SELECT id FROM projects WHERE id = $1', [projectId]);
    if (checkProject.rows.length === 0) {
      return res.status(404).json({
        error: 'This project does not exist.',
        details: [],
      });
    }

    const memberCheck = await pool.query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({
        error: 'You are not a member of this project.',
        details: [],
      });
    }

    const result = await pool.query(
      `SELECT 
        p.id,
        p.name,
        p.description,
        p.owner_id,
        p.created_at,
        p.updated_at,
        pm.role,
        (SELECT COUNT(*)::int FROM tasks t WHERE t.project_id = p.id) AS task_count,
        (SELECT COUNT(*)::int FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS done_count,
        (SELECT COUNT(*)::int FROM project_members pm2 WHERE pm2.project_id = p.id) AS member_count
      FROM projects p
      JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $2
      WHERE p.id = $1`,
      [projectId, req.user.id]
    );

    return res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function updateProject(req, res, next) {
  try {
    const projectId = parseId(req.params.id);
    if (isNaN(projectId) || projectId <= 0) {
      return res.status(400).json({
        error: 'Invalid project ID',
        details: [],
      });
    }

    const checkProject = await pool.query('SELECT id FROM projects WHERE id = $1', [projectId]);
    if (checkProject.rows.length === 0) {
      return res.status(404).json({
        error: 'This project does not exist.',
        details: [],
      });
    }

    const memberCheck = await pool.query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );

    if (memberCheck.rows.length === 0 || memberCheck.rows[0].role !== 'owner') {
      return res.status(403).json({
        error: 'Only the project owner can update this project.',
        details: [],
      });
    }

    const name = req.body.name.trim();
    const description = req.body.description !== undefined
      ? (req.body.description && req.body.description.trim() ? req.body.description.trim() : null)
      : undefined;

    let updateResult;
    if (description !== undefined) {
      updateResult = await pool.query(
        `UPDATE projects
         SET name = $1, description = $2
         WHERE id = $3
         RETURNING id, owner_id, name, description, created_at, updated_at`,
        [name, description, projectId]
      );
    } else {
      updateResult = await pool.query(
        `UPDATE projects
         SET name = $1
         WHERE id = $2
         RETURNING id, owner_id, name, description, created_at, updated_at`,
        [name, projectId]
      );
    }

    const updated = updateResult.rows[0];

    const counts = await pool.query(
      `SELECT 
        (SELECT COUNT(*)::int FROM tasks t WHERE t.project_id = $1) AS task_count,
        (SELECT COUNT(*)::int FROM tasks t WHERE t.project_id = $1 AND t.status = 'done') AS done_count,
        (SELECT COUNT(*)::int FROM project_members pm2 WHERE pm2.project_id = $1) AS member_count`,
      [projectId]
    );

    return res.json({
      ...updated,
      role: 'owner',
      task_count: counts.rows[0].task_count,
      done_count: counts.rows[0].done_count,
      member_count: counts.rows[0].member_count,
    });
  } catch (err) {
    next(err);
  }
}

async function deleteProject(req, res, next) {
  try {
    const projectId = parseId(req.params.id);
    if (isNaN(projectId) || projectId <= 0) {
      return res.status(400).json({
        error: 'Invalid project ID',
        details: [],
      });
    }

    const checkProject = await pool.query('SELECT id FROM projects WHERE id = $1', [projectId]);
    if (checkProject.rows.length === 0) {
      return res.status(404).json({
        error: 'This project does not exist.',
        details: [],
      });
    }

    const memberCheck = await pool.query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );

    if (memberCheck.rows.length === 0 || memberCheck.rows[0].role !== 'owner') {
      return res.status(403).json({
        error: 'Only the project owner can delete this project.',
        details: [],
      });
    }

    await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
}

async function listMembers(req, res, next) {
  try {
    const projectId = parseId(req.params.id);
    if (isNaN(projectId) || projectId <= 0) {
      return res.status(400).json({
        error: 'Invalid project ID',
        details: [],
      });
    }

    const checkProject = await pool.query('SELECT id FROM projects WHERE id = $1', [projectId]);
    if (checkProject.rows.length === 0) {
      return res.status(404).json({
        error: 'This project does not exist.',
        details: [],
      });
    }

    const memberCheck = await pool.query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({
        error: 'You are not a member of this project.',
        details: [],
      });
    }

    const result = await pool.query(
      `SELECT 
        pm.project_id,
        pm.user_id,
        pm.role,
        pm.joined_at,
        u.name,
        u.email
      FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = $1
      ORDER BY (pm.role = 'owner') DESC, pm.joined_at ASC, u.name ASC`,
      [projectId]
    );

    return res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

async function addMember(req, res, next) {
  try {
    const projectId = parseId(req.params.id);
    if (isNaN(projectId) || projectId <= 0) {
      return res.status(400).json({
        error: 'Invalid project ID',
        details: [],
      });
    }

    const checkProject = await pool.query('SELECT id FROM projects WHERE id = $1', [projectId]);
    if (checkProject.rows.length === 0) {
      return res.status(404).json({
        error: 'This project does not exist.',
        details: [],
      });
    }

    const memberCheck = await pool.query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );

    if (memberCheck.rows.length === 0 || memberCheck.rows[0].role !== 'owner') {
      return res.status(403).json({
        error: 'Only the project owner can add members.',
        details: [],
      });
    }

    const email = req.body.email.trim().toLowerCase();
    const userRes = await pool.query(
      'SELECT id, name, email FROM users WHERE email = $1',
      [email]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({
        error: 'No TaskFlow account uses this email.',
        details: [],
      });
    }

    const targetUser = userRes.rows[0];

    const existingMember = await pool.query(
      'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, targetUser.id]
    );

    if (existingMember.rows.length > 0) {
      return res.status(409).json({
        error: 'User is already a member of this project.',
        details: [],
      });
    }

    const insertRes = await pool.query(
      `INSERT INTO project_members (project_id, user_id, role)
       VALUES ($1, $2, 'member')
       RETURNING project_id, user_id, role, joined_at`,
      [projectId, targetUser.id]
    );

    return res.status(201).json({
      ...insertRes.rows[0],
      name: targetUser.name,
      email: targetUser.email,
    });
  } catch (err) {
    next(err);
  }
}

async function removeMember(req, res, next) {
  const client = await pool.connect();
  try {
    const projectId = parseId(req.params.id);
    const userId = parseId(req.params.userId);

    if (isNaN(projectId) || projectId <= 0 || isNaN(userId) || userId <= 0) {
      return res.status(400).json({
        error: 'Invalid parameter ID',
        details: [],
      });
    }

    const checkProject = await client.query('SELECT id FROM projects WHERE id = $1', [projectId]);
    if (checkProject.rows.length === 0) {
      return res.status(404).json({
        error: 'This project does not exist.',
        details: [],
      });
    }

    const ownerCheck = await client.query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );

    if (ownerCheck.rows.length === 0 || ownerCheck.rows[0].role !== 'owner') {
      return res.status(403).json({
        error: 'Only the project owner can remove members.',
        details: [],
      });
    }

    const targetCheck = await client.query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (targetCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Member not found in this project.',
        details: [],
      });
    }

    if (targetCheck.rows[0].role === 'owner') {
      return res.status(400).json({
        error: 'Cannot remove owner from project.',
        details: [],
      });
    }

    await client.query('BEGIN');

    // On member removal, unassign that user's tasks in the project
    await client.query(
      'UPDATE tasks SET assignee_id = NULL WHERE project_id = $1 AND assignee_id = $2',
      [projectId, userId]
    );

    await client.query(
      'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, userId]
    );

    await client.query('COMMIT');

    return res.status(204).send();
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

module.exports = {
  listProjects,
  createProject,
  getProject,
  updateProject,
  deleteProject,
  listMembers,
  addMember,
  removeMember,
};
