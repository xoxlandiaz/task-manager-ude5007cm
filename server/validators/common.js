const { parseId } = require('../utils/ids');

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// Optional free text: absent, null or a string.
function isOptionalText(value) {
  return value === undefined || value === null || typeof value === 'string';
}

// True only for a real calendar date written as YYYY-MM-DD
// ("2026-02-31" and "2026-13-01" are rejected).
function isValidDate(value) {
  if (typeof value !== 'string') return false;
  const text = value.slice(0, 10);
  if (!dateRegex.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

function isValidId(value) {
  return !isNaN(parseId(value));
}

module.exports = { emailRegex, isOptionalText, isValidDate, isValidId };
