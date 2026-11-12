// PostgreSQL text cannot store the NUL character (U+0000). Refuse it in any
// string of the body or query string, so it never reaches a query.
function hasNullByte(value) {
  if (typeof value === 'string') return value.includes('\u0000');
  if (value && typeof value === 'object') return Object.values(value).some(hasNullByte);
  return false;
}

function rejectNullBytes(req, res, next) {
  if (hasNullByte(req.body) || hasNullByte(req.query)) {
    return res.status(400).json({
      error: 'Text contains an invalid character',
      details: [],
    });
  }
  next();
}

module.exports = rejectNullBytes;
