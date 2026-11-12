// Largest value of a PostgreSQL INTEGER column (all our ids are INTEGER).
const MAX_ID = 2147483647;

// Strictly parses a positive integer id. Returns NaN for anything else:
// "1abc", "-1", "0", "1.5" or a number that does not fit into INTEGER.
function parseId(value) {
  const text = typeof value === 'number' ? String(value) : value;
  if (typeof text !== 'string' || !/^[1-9]\d{0,9}$/.test(text)) return NaN;
  const id = Number(text);
  return id <= MAX_ID ? id : NaN;
}

module.exports = { parseId, MAX_ID };
