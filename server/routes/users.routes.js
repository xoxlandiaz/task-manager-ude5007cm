const express = require('express');
const router = express.Router();
const usersController = require('../controllers/users.controller');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/me', usersController.getMe);
router.get('/', usersController.getUsers);
router.get('/:id', usersController.getUserById);

module.exports = router;
