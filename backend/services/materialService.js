import fs from 'fs';
import Material from '../models/Material.js';
import DocumentChunk from '../models/DocumentChunk.js';
import Job from '../models/Job.js';
import Project from '../models/Project.js';
import { processMaterialJob } from './pdfProcessingService.js';

export const getProjectMaterials = async (projectId, userId) => {
  return await Material.find({ projectId, userId }).sort({ createdAt: -1 });
};

export const getMaterialById = async (materialId, userId) => {
  const material = await Material.findOne({ _id: materialId, userId });
  if (!material) {
    throw new Error('Material not found or unauthorized');
  }

  // Fetch sample chunks preview (e.g. first 5 chunks)
  const chunksPreview = await DocumentChunk.find({ materialId })
    .sort({ chunkIndex: 1 })
    .limit(5)
    .select('pageNumber chunkIndex text metadata');

  return {
    material,
    chunksPreview,
  };
};

export const createMaterialAndQueueJob = async ({ userId, projectId, file }) => {
  // Enforce project ownership check
  const project = await Project.findOne({ _id: projectId, userId });
  if (!project) {
    // Cleanup uploaded file if project not authorized
    if (file && file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    throw new Error('Project not found or unauthorized access');
  }

  if (!file) {
    throw new Error('No PDF file provided for upload');
  }

  // Create Material document in QUEUED status
  const material = await Material.create({
    userId,
    projectId,
    fileName: file.originalname,
    storagePath: file.path,
    fileType: file.mimetype || 'application/pdf',
    fileSize: file.size,
    status: 'QUEUED',
  });

  // Create Job document
  const job = await Job.create({
    type: 'MATERIAL_PROCESSING',
    status: 'queued',
    payload: {
      materialId: material._id,
      userId,
      projectId,
      filePath: file.path,
    },
    relatedEntityId: material._id,
  });

  // Trigger background processing asynchronously (non-blocking)
  setImmediate(() => {
    processMaterialJob(job._id).catch((err) => {
      console.error(`[Async Processing Exception] Job ${job._id}:`, err);
    });
  });

  return material;
};

export const deleteMaterial = async (materialId, userId) => {
  const material = await Material.findOne({ _id: materialId, userId });
  if (!material) {
    throw new Error('Material not found or unauthorized');
  }

  // Delete physical storage file if present
  if (material.storagePath && fs.existsSync(material.storagePath)) {
    try {
      fs.unlinkSync(material.storagePath);
    } catch (e) {
      console.warn(`[File Delete Warning] Could not remove file: ${material.storagePath}`);
    }
  }

  // Delete associated document chunks & job records
  await DocumentChunk.deleteMany({ materialId });
  await Job.deleteMany({ relatedEntityId: materialId });
  await Material.deleteOne({ _id: materialId });

  return { success: true, message: 'Material and associated document chunks deleted successfully' };
};

export const retryMaterialProcessing = async (materialId, userId) => {
  const material = await Material.findOne({ _id: materialId, userId });
  if (!material) {
    throw new Error('Material not found or unauthorized');
  }

  // NOTE: previously this deleted every existing DocumentChunk for the
  // material before re-queuing, "for idempotency". That's what made a 429
  // partway through an upload so costly: Retry always started over from
  // chunk 0. pdfProcessingService now upserts by (materialId, chunkIndex)
  // and only asks Gemini for chunks that don't already have a valid current
  // embedding, so chunks embedded before the failure are preserved and
  // reused here rather than deleted.

  // Reset status to QUEUED
  material.status = 'QUEUED';
  material.failureReason = '';
  await material.save();

  // Create fresh Job record
  const job = await Job.create({
    type: 'MATERIAL_PROCESSING',
    status: 'queued',
    payload: {
      materialId: material._id,
      userId,
      projectId: material.projectId,
      filePath: material.storagePath,
    },
    relatedEntityId: material._id,
  });

  // Trigger background execution
  setImmediate(() => {
    processMaterialJob(job._id).catch((err) => {
      console.error(`[Async Retry Exception] Job ${job._id}:`, err);
    });
  });

  return material;
};
