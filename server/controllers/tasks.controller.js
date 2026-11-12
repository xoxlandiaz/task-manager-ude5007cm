const pool = require('../db/pool');
const { parseId } = require('../utils/ids');

const TASK_SELECT_WITH_JOINS = `
  SELECT 
    t.id,
    t.project_id,
    t.assignee_id,
    t.created_by,
    t.title,
    t.description,
    t.status,
    t.priority,
    t.due_date,
    t.created_at,
    t.updated_at,
    u.name AS assignee_name,
    c.name AS created_by_name
  FROM tasks t
  LEFT JOIN users u ON u.id = t.assignee_id
  LEFT JOIN users c ON c.id = t.created_by
`;

async function listProjectTasks(req, res, next) {
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
      `${TASK_SELECT_WITH_JOINS}
       WHERE t.project_id = $1
       ORDER BY t.created_at ASC`,
      [projectId]
    );

    return res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

async function createTask(req, res, next) {
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

    const title = req.body.title.trim();
    const description = req.body.description && req.body.description.trim()
      ? req.body.description.trim()
      : null;
    const status = req.body.status || 'todo';
    const priority = req.body.priority || 'medium';
    const dueDate = req.body.due_date && req.body.due_date.trim()
      ? req.body.due_date.slice(0, 10)
      : null;
    const assigneeId = req.body.assignee_id !== undefined && req.body.assignee_id !== null && req.body.assignee_id !== ''
      ? Number(req.body.assignee_id)
      : null;

    if (assigneeId) {
      const assigneeCheck = await pool.query(
        'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
        [projectId, assigneeId]
      );
      if (assigneeCheck.rows.length === 0) {
        return res.status(400).json({
          error: 'Validation failed',
          details: [{ field: 'assignee_id', message: 'Assignee must be a project member' }],
        });
      }
    }

    const insertRes = await pool.query(
      `INSERT INTO tasks (project_id, assignee_id, created_by, title, description, status, priority, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [projectId, assigneeId, req.user.id, title, description, status, priority, dueDate]
    );

    const taskId = insertRes.rows[0].id;

    const taskResult = await pool.query(
      `${TASK_SELECT_WITH_JOINS} WHERE t.id = $1`,
      [taskId]
    );

    return res.status(201).json(taskResult.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function getTask(req, res, next) {
  try {
    const taskId = parseId(req.params.id);
    if (isNaN(taskId) || taskId <= 0) {
      return res.status(400).json({
        error: 'Invalid task ID',
        details: [],
      });
    }

    const result = await pool.query(
      `${TASK_SELECT_WITH_JOINS} WHERE t.id = $1`,
      [taskId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'This task does not exist.',
        details: [],
      });
    }

    const task = result.rows[0];

    const memberCheck = await pool.query(
      'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
      [task.project_id, req.user.id]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({
        error: 'You are not a member of this project.',
        details: [],
      });
    }

    return res.json(task);
  } catch (err) {
    next(err);
  }
}

async function updateTask(req, res, next) {
  try {
    const taskId = parseId(req.params.id);
    if (isNaN(taskId) || taskId <= 0) {
      return res.status(400).json({
        error: 'Invalid task ID',
        details: [],
      });
    }

    const checkTask = await pool.query('SELECT project_id, assignee_id FROM tasks WHERE id = $1', [taskId]);
    if (checkTask.rows.length === 0) {
      return res.status(404).json({
        error: 'This task does not exist.',
        details: [],
      });
    }

    const { project_id: projectId } = checkTask.rows[0];

    const memberCheck = await pool.query(
      'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({
        error: 'You are not a member of this project.',
        details: [],
      });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (req.body.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(req.body.title.trim());
    }

    if (req.body.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(req.body.description && req.body.description.trim() ? req.body.description.trim() : null);
    }

    if (req.body.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(req.body.status);
    }

    if (req.body.priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`);
      values.push(req.body.priority);
    }

    if (req.body.assignee_id !== undefined) {
      const assigneeId = req.body.assignee_id !== null && req.body.assignee_id !== ''
        ? Number(req.body.assignee_id)
        : null;

      if (assigneeId) {
        const assigneeCheck = await pool.query(
          'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
          [projectId, assigneeId]
        );
        if (assigneeCheck.rows.length === 0) {
          return res.status(400).json({
            error: 'Validation failed',
            details: [{ field: 'assignee_id', message: 'Assignee must be a project member' }],
          });
        }
      }

      updates.push(`assignee_id = $${paramIndex++}`);
      values.push(assigneeId);
    }

    if (req.body.due_date !== undefined) {
      const dueDate = req.body.due_date && req.body.due_date.trim()
        ? req.body.due_date.slice(0, 10)
        : null;
      updates.push(`due_date = $${paramIndex++}`);
      values.push(dueDate);
    }

    if (updates.length > 0) {
      values.push(taskId);
      await pool.query(
        `UPDATE tasks
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex}`,
        values
      );
    }

    const updatedResult = await pool.query(
      `${TASK_SELECT_WITH_JOINS} WHERE t.id = $1`,
      [taskId]
    );

    return res.json(updatedResult.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function deleteTask(req, res, next) {
  try {
    const taskId = parseId(req.params.id);
    if (isNaN(taskId) || taskId <= 0) {
      return res.status(400).json({
        error: 'Invalid task ID',
        details: [],
      });
    }

    const checkTask = await pool.query('SELECT project_id FROM tasks WHERE id = $1', [taskId]);
    if (checkTask.rows.length === 0) {
      return res.status(404).json({
        error: 'This task does not exist.',
        details: [],
      });
    }

    const { project_id: projectId } = checkTask.rows[0];

    const memberCheck = await pool.query(
      'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({
        error: 'You are not a member of this project.',
        details: [],
      });
    }

    await pool.query('DELETE FROM tasks WHERE id = $1', [taskId]);

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listProjectTasks,
  createTask,
  getTask,
  updateTask,
  deleteTask,
};
