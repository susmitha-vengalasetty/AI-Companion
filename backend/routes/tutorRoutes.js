import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  getConversations,
  createConversation,
  getConversationById,
  askInConversation,
  deleteConversation,
  askTutor,
  getTutorHistory,
  clearTutorHistory,
} from '../controllers/tutorController.js';

const router = express.Router({ mergeParams: true });

router.use(protect);

// Conversation management endpoints
router.get('/conversations', getConversations);
router.post('/conversations', createConversation);
router.get('/conversations/:conversationId', getConversationById);
router.post('/conversations/:conversationId/messages', askInConversation);
router.delete('/conversations/:conversationId', deleteConversation);

// Legacy single-thread endpoints
router.post('/ask', askTutor);
router.get('/history', getTutorHistory);
router.delete('/history', clearTutorHistory);

export default router;
