function validate(validatorFn) {
  return (req, res, next) => {
    const details = validatorFn(req.body);
    if (details && details.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details,
      });
    }
    next();
  };
}

module.exports = validate;
