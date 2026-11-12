const pool = require('../db/pool');

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

module.exports = {
  getMe,
};
