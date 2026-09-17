import express from 'express';
import {
  getProjectMaterials,
  uploadMaterial,
  getMaterial,
  getMaterialStatus,
  deleteMaterial,
  retryMaterial,
} from '../controllers/materialController.js';
import { protect } from '../middleware/auth.js';
import { verifyProjectOwnership } from '../middleware/ownership.js';
import { uploadPDF } from '../middleware/upload.js';

const router = express.Router({ mergeParams: true });

router.use(protect);

// Nested routes under /api/projects/:projectId/materials
router.route('/projects/:projectId/materials')
  .get(verifyProjectOwnership, getProjectMaterials)
  .post(verifyProjectOwnership, uploadPDF.single('file'), uploadMaterial);

// Direct material endpoints under /api/materials
router.get('/materials/:materialId', getMaterial);
router.get('/materials/:materialId/status', getMaterialStatus);
router.delete('/materials/:materialId', deleteMaterial);
router.post('/materials/:materialId/retry', retryMaterial);

export default router;
