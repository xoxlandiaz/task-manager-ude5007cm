const pool = require('../db/pool');
const { parseId } = require('../utils/ids');

async function listComments(req, res, next) {
  try {
    const taskId = parseId(req.params.taskId || req.params.id);
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

    const result = await pool.query(
      `SELECT 
        c.id,
        c.task_id,
        c.user_id,
        c.body,
        c.created_at,
        u.name AS author_name,
        u.email AS author_email
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.task_id = $1
      ORDER BY c.created_at ASC`,
      [taskId]
    );

    return res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

async function createComment(req, res, next) {
  try {
    const taskId = parseId(req.params.taskId || req.params.id);
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

    const body = req.body.body.trim();

    const insertRes = await pool.query(
      `INSERT INTO comments (task_id, user_id, body)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [taskId, req.user.id, body]
    );

    const commentId = insertRes.rows[0].id;

    const commentResult = await pool.query(
      `SELECT 
        c.id,
        c.task_id,
        c.user_id,
        c.body,
        c.created_at,
        u.name AS author_name,
        u.email AS author_email
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.id = $1`,
      [commentId]
    );

    return res.status(201).json(commentResult.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function deleteComment(req, res, next) {
  try {
    const commentId = parseId(req.params.id);
    if (isNaN(commentId) || commentId <= 0) {
      return res.status(400).json({
        error: 'Invalid comment ID',
        details: [],
      });
    }

    const result = await pool.query(
      `SELECT 
        c.id,
        c.user_id,
        t.project_id,
        p.owner_id
      FROM comments c
      JOIN tasks t ON t.id = c.task_id
      JOIN projects p ON p.id = t.project_id
      WHERE c.id = $1`,
      [commentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Comment not found.',
        details: [],
      });
    }

    const comment = result.rows[0];

    // Someone removed from the project loses access to it, own comments included.
    const memberCheck = await pool.query(
      'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
      [comment.project_id, req.user.id]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({
        error: 'You are not a member of this project.',
        details: [],
      });
    }

    if (comment.user_id !== req.user.id && comment.owner_id !== req.user.id) {
      return res.status(403).json({
        error: 'You are not authorized to delete this comment.',
        details: [],
      });
    }

    await pool.query('DELETE FROM comments WHERE id = $1', [commentId]);

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listComments,
  createComment,
  deleteComment,
};
