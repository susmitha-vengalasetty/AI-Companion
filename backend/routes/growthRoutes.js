import express from 'express';
import { protect } from '../middleware/auth.js';
import { getGrowthMetrics, getRecommendations, getAnalytics } from '../controllers/growthController.js';

const router = express.Router({ mergeParams: true });

router.use(protect);

router.get('/', getGrowthMetrics);
router.get('/recommendations', getRecommendations);
router.get('/analytics', getAnalytics);

export default router;
