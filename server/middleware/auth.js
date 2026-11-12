const { verifyToken } = require('../utils/jwt');

function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication token required',
      details: [],
    });
  }

  const token = authHeader.slice(7).trim();
  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Invalid or expired token',
      details: [],
    });
  }
}

module.exports = auth;
