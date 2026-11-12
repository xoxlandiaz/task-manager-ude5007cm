// PostgreSQL error codes that mean "the client sent bad data".
// Validators catch these first; this is the second line of defence.
const PG_CLIENT_ERRORS = {
  23505: [409, 'Resource already exists'], // unique_violation
  23503: [400, 'Related resource does not exist'], // foreign_key_violation
  23502: [400, 'A required value is missing'], // not_null_violation
  23514: [400, 'A value is not allowed'], // check_violation
  '22P02': [400, 'Invalid parameter format'], // invalid_text_representation
  22003: [400, 'A number is out of range'], // numeric_value_out_of_range
  22007: [400, 'Invalid date format'], // invalid_datetime_format
  22008: [400, 'A date is out of range'], // datetime_field_overflow
  22001: [400, 'A value is too long'], // string_data_right_truncation
  22021: [400, 'Text contains an invalid character'], // character_not_in_repertoire
};

// Every error response has the same shape: { error, details }.
// eslint-disable-next-line no-unused-vars -- Express needs all four arguments
function errorHandler(err, req, res, next) {
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal server error';
  const details = Array.isArray(err.details) ? err.details : [];

  if (PG_CLIENT_ERRORS[err.code]) {
    [status, message] = PG_CLIENT_ERRORS[err.code];
  } else if (err.type === 'entity.parse.failed') {
    message = 'Request body is not valid JSON';
  } else if (err.type === 'entity.too.large') {
    message = 'Request body is too large';
  }

  if (status >= 500) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Unhandled server error:', err);
    }
    // Never show internal details (SQL, stack, file paths) to the client.
    message = 'Internal server error';
  }

  res.status(status).json({ error: message, details });
}

module.exports = errorHandler;
