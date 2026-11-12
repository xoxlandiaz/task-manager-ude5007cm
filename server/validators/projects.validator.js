const { emailRegex, isOptionalText } = require('./common');

// Create and update take the same fields: name (required) and description.
function validateProject(body = {}) {
  const errors = [];
  const name = typeof body.name === 'string' ? body.name.trim() : '';

  if (!name) {
    errors.push({ field: 'name', message: 'Project name is required' });
  } else if (name.length > 150) {
    errors.push({ field: 'name', message: 'Project name must not exceed 150 characters' });
  }

  if (!isOptionalText(body.description)) {
    errors.push({ field: 'description', message: 'Description must be text' });
  }

  return errors;
}

function validateAddMember(body = {}) {
  const errors = [];
  const email = typeof body.email === 'string' ? body.email.trim() : '';

  if (!email) {
    errors.push({ field: 'email', message: 'Email is required' });
  } else if (!emailRegex.test(email)) {
    errors.push({ field: 'email', message: 'Enter a valid email address.' });
  }

  return errors;
}

module.exports = {
  validateCreateProject: validateProject,
  validateUpdateProject: validateProject,
  validateAddMember,
};
