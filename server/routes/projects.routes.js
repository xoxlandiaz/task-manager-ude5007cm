const express = require('express');
const router = express.Router();
const projectsController = require('../controllers/projects.controller');
const tasksController = require('../controllers/tasks.controller');
const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  validateCreateProject,
  validateUpdateProject,
  validateAddMember,
  validateCreateTask,
} = require('../validators');

router.use(authMiddleware);

// Project CRUD
router.get('/', projectsController.listProjects);
router.post('/', validate(validateCreateProject), projectsController.createProject);
router.get('/:id', projectsController.getProject);
router.put('/:id', validate(validateUpdateProject), projectsController.updateProject);
router.delete('/:id', projectsController.deleteProject);

// Members
router.get('/:id/members', projectsController.listMembers);
router.post('/:id/members', validate(validateAddMember), projectsController.addMember);
router.delete('/:id/members/:userId', projectsController.removeMember);

// Project Tasks
router.get('/:id/tasks', tasksController.listProjectTasks);
router.post('/:id/tasks', validate(validateCreateTask), tasksController.createTask);

module.exports = router;
