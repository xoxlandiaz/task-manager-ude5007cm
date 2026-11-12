const { isOptionalText, isValidDate, isValidId } = require('./common');

const VALID_STATUSES = ['todo', 'in_progress', 'done'];
const VALID_PRIORITIES = ['low', 'medium', 'high'];

const isBlank = (value) => value === undefined || value === null || value === '';

// Checks shared by create and update. On create, a missing or null status and
// priority fall back to the defaults; on update null is rejected, because
// these columns are NOT NULL.
function validateTaskFields(body, errors, { allowNullEnums }) {
  if (!isOptionalText(body.description)) {
    errors.push({ field: 'description', message: 'Description must be text' });
  }

  const skipEnum = (value) => value === undefined || (allowNullEnums && value === null);

  if (!skipEnum(body.status) && !VALID_STATUSES.includes(body.status)) {
    errors.push({ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  if (!skipEnum(body.priority) && !VALID_PRIORITIES.includes(body.priority)) {
    errors.push({ field: 'priority', message: `Priority must be one of: ${VALID_PRIORITIES.join(', ')}` });
  }

  if (!isBlank(body.due_date) && !isValidDate(body.due_date)) {
    errors.push({ field: 'due_date', message: 'Due date must be a valid date (YYYY-MM-DD)' });
  }

  if (!isBlank(body.assignee_id) && !isValidId(body.assignee_id)) {
    errors.push({ field: 'assignee_id', message: 'Assignee ID must be a valid positive integer' });
  }
}

function validateCreateTask(body = {}) {
  const errors = [];
  const title = typeof body.title === 'string' ? body.title.trim() : '';

  if (!title) {
    errors.push({ field: 'title', message: 'Task title is required' });
  } else if (title.length > 200) {
    errors.push({ field: 'title', message: 'Task title must not exceed 200 characters' });
  }

  validateTaskFields(body, errors, { allowNullEnums: true });
  return errors;
}

function validateUpdateTask(body = {}) {
  const errors = [];

  const fields = ['title', 'description', 'status', 'priority', 'assignee_id', 'due_date'];
  const hasUpdate = fields.some((f) => Object.prototype.hasOwnProperty.call(body, f));

  if (!hasUpdate) {
    errors.push({ field: 'general', message: 'At least one field must be provided for update' });
    return errors;
  }

  if (body.title !== undefined) {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) {
      errors.push({ field: 'title', message: 'Task title cannot be empty' });
    } else if (title.length > 200) {
      errors.push({ field: 'title', message: 'Task title must not exceed 200 characters' });
    }
  }

  validateTaskFields(body, errors, { allowNullEnums: false });
  return errors;
}

module.exports = {
  validateCreateTask,
  validateUpdateTask,
  VALID_STATUSES,
  VALID_PRIORITIES,
};
