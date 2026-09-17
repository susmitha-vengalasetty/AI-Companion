import express from 'express';
import {
  getProject,
  updateProject,
  deleteProject,
  getProjectDashboard,
} from '../controllers/projectController.js';
import { protect } from '../middleware/auth.js';
import { verifyProjectOwnership } from '../middleware/ownership.js';

import tutorRoutes from './tutorRoutes.js';
import quizRoutes from './quizRoutes.js';
import growthRoutes from './growthRoutes.js';

const router = express.Router();

router.use(protect);

router.use('/:projectId/tutor', tutorRoutes);
router.use('/:projectId/quiz', quizRoutes);
router.use('/:projectId/growth', growthRoutes);

router.route('/:projectId')
  .get(verifyProjectOwnership, getProject)
  .patch(verifyProjectOwnership, updateProject)
  .delete(verifyProjectOwnership, deleteProject);

router.get('/:projectId/dashboard', verifyProjectOwnership, getProjectDashboard);

export default router;
