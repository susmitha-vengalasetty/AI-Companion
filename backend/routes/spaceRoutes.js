import express from 'express';
import {
  getSpaces,
  createSpace,
  getSpace,
  updateSpace,
  deleteSpace,
} from '../controllers/spaceController.js';
import {
  getSpaceProjects,
  createProject,
} from '../controllers/projectController.js';
import { protect } from '../middleware/auth.js';
import { verifySpaceOwnership } from '../middleware/ownership.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getSpaces)
  .post(createSpace);

router.route('/:spaceId')
  .get(verifySpaceOwnership, getSpace)
  .patch(verifySpaceOwnership, updateSpace)
  .delete(verifySpaceOwnership, deleteSpace);

// Nested project routes under space
router.route('/:spaceId/projects')
  .get(verifySpaceOwnership, getSpaceProjects)
  .post(verifySpaceOwnership, createProject);

export default router;
