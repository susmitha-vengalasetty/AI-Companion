import express from 'express';
import { protect } from '../middleware/auth.js';
import { generateQuiz, submitQuiz, getQuizHistory } from '../controllers/quizController.js';

const router = express.Router({ mergeParams: true });

router.use(protect);

router.post('/generate', generateQuiz);
router.post('/:quizId/submit', submitQuiz);
router.get('/history', getQuizHistory);

export default router;
