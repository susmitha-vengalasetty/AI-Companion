import express from 'express';
import { protect, adminOnly } from '../middleware/auth.js';
import {
  getOverview,
  getUsers,
  getActivity,
  getAIUsage,
  getProcessingStats,
  getHealth,
} from '../controllers/adminController.js';

const router = express.Router();

// Enforce authentication & admin authorization on all admin routes
router.use(protect);
router.use(adminOnly);

router.get('/overview', getOverview);
router.get('/users', getUsers);
router.get('/activity', getActivity);
router.get('/ai-usage', getAIUsage);
router.get('/processing', getProcessingStats);
router.get('/health', getHealth);

export default router;
