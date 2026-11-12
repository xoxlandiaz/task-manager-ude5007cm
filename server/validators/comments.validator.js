function validateCreateComment(body = {}) {
  const errors = [];
  const bodyText = typeof body.body === 'string' ? body.body.trim() : '';

  if (!bodyText) {
    errors.push({ field: 'body', message: 'Comment body cannot be empty' });
  }

  return errors;
}

module.exports = {
  validateCreateComment,
};
