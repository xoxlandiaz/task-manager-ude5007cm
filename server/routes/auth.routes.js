const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validate');
const { validateRegister, validateLogin } = require('../validators');

router.post('/register', validate(validateRegister), authController.register);
router.post('/login', validate(validateLogin), authController.login);
router.get('/me', authMiddleware, authController.me);

module.exports = router;
