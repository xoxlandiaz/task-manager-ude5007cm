const express = require('express');
const router = express.Router();
const tasksController = require('../controllers/tasks.controller');
const commentsController = require('../controllers/comments.controller');
const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validate');
const { validateUpdateTask, validateCreateComment } = require('../validators');

router.use(authMiddleware);

// Tasks
router.get('/:id', tasksController.getTask);
router.put('/:id', validate(validateUpdateTask), tasksController.updateTask);
router.delete('/:id', tasksController.deleteTask);

// Comments on task
router.get('/:id/comments', commentsController.listComments);
router.post('/:id/comments', validate(validateCreateComment), commentsController.createComment);

module.exports = router;
