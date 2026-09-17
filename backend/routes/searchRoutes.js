import express from 'express';
import { searchProjectKnowledgeHandler, getRAGContextHandler } from '../controllers/searchController.js';
import { protect } from '../middleware/auth.js';
import { verifyProjectOwnership } from '../middleware/ownership.js';

const router = express.Router({ mergeParams: true });

router.use(protect);

router.post('/projects/:projectId/search', verifyProjectOwnership, searchProjectKnowledgeHandler);
router.post('/projects/:projectId/rag-context', verifyProjectOwnership, getRAGContextHandler);

export default router;
