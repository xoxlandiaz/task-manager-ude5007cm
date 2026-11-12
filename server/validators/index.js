const { validateRegister, validateLogin } = require('./auth.validator');
const { validateCreateProject, validateUpdateProject, validateAddMember } = require('./projects.validator');
const { validateCreateTask, validateUpdateTask } = require('./tasks.validator');
const { validateCreateComment } = require('./comments.validator');

module.exports = {
  validateRegister,
  validateLogin,
  validateCreateProject,
  validateUpdateProject,
  validateAddMember,
  validateCreateTask,
  validateUpdateTask,
  validateCreateComment,
};
