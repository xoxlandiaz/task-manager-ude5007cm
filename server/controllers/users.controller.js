const pool = require('../db/pool');
const { parseId } = require('../utils/ids');

async function getMe(req, res, next) {
  try {
    const result = await pool.query(
      'SELECT id, name, email, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        details: [],
      });
    }
    return res.json({
      user: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

async function getUsers(req, res, next) {
  try {
    const search = req.query.search || req.query.q;
    let result;
    if (typeof search === 'string' && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      result = await pool.query(
        'SELECT id, name, email, created_at FROM users WHERE lower(name) LIKE $1 OR lower(email) LIKE $1 ORDER BY name ASC LIMIT 50',
        [term]
      );
    } else {
      result = await pool.query(
        'SELECT id, name, email, created_at FROM users ORDER BY name ASC LIMIT 100'
      );
    }
    return res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

async function getUserById(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        error: 'Invalid user ID',
        details: [],
      });
    }

    const result = await pool.query(
      'SELECT id, name, email, created_at FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        details: [],
      });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMe,
  getUsers,
  getUserById,
};
