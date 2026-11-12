const { emailRegex } = require('./common');

// bcrypt only uses the first 72 bytes of a password, so longer ones are refused
// instead of being silently cut.
const MAX_PASSWORD_BYTES = 72;

function validateRegister(body = {}) {
  const errors = [];
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!name) {
    errors.push({ field: 'name', message: 'Name is required' });
  } else if (name.length > 100) {
    errors.push({ field: 'name', message: 'Name must not exceed 100 characters' });
  }

  if (!email) {
    errors.push({ field: 'email', message: 'Email is required' });
  } else if (!emailRegex.test(email) || email.length > 255) {
    errors.push({ field: 'email', message: 'Enter a valid email address.' });
  }

  if (!password) {
    errors.push({ field: 'password', message: 'Password is required' });
  } else if (password.length < 8) {
    errors.push({ field: 'password', message: 'Password must be at least 8 characters long.' });
  } else if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    errors.push({ field: 'password', message: 'Password is too long (maximum 72 bytes).' });
  }

  return errors;
}

function validateLogin(body = {}) {
  const errors = [];
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email) {
    errors.push({ field: 'email', message: 'Email is required' });
  } else if (!emailRegex.test(email)) {
    errors.push({ field: 'email', message: 'Enter a valid email address.' });
  }

  if (!password) {
    errors.push({ field: 'password', message: 'Password is required' });
  }

  return errors;
}

module.exports = {
  validateRegister,
  validateLogin,
};
