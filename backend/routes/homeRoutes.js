import express from 'express';
import { getHomeDashboard } from '../controllers/homeController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, getHomeDashboard);

export default router;
