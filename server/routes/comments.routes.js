const express = require('express');
const router = express.Router();
const commentsController = require('../controllers/comments.controller');
const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validate');
const { validateCreateComment } = require('../validators');

router.use(authMiddleware);

// Direct comment deletion
router.delete('/:id', commentsController.deleteComment);

// If accessed via /api/comments/:taskId
router.get('/:taskId', commentsController.listComments);
router.post('/:taskId', validate(validateCreateComment), commentsController.createComment);

module.exports = router;
