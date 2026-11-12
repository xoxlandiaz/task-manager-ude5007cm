const express = require('express');
const router = express.Router();
const usersController = require('../controllers/users.controller');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/me', usersController.getMe);
// There is deliberately no user list or lookup by id: it would hand every
// account's email to anyone who registers. Members are added by exact email.

module.exports = router;
