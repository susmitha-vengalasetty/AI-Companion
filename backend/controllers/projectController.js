import * as projectService from '../services/projectService.js';
import Material from '../models/Material.js';
import DocumentChunk from '../models/DocumentChunk.js';

export const getSpaceProjects = async (req, res) => {
  try {
    const projects = await projectService.getProjectsBySpace(req.params.spaceId, req.user._id);
    res.status(200).json({ success: true, count: projects.length, data: projects });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createProject = async (req, res) => {
  try {
    const { name, description, learningGoal } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Project name is required' });
    }
    const project = await projectService.createProject(req.user._id, req.params.spaceId, {
      name,
      description,
      learningGoal,
    });
    res.status(201).json({ success: true, data: project });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getProject = async (req, res) => {
  try {
    const project = await projectService.getProjectById(req.params.projectId, req.user._id);
    res.status(200).json({ success: true, data: project });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

export const updateProject = async (req, res) => {
  try {
    const project = await projectService.updateProject(req.params.projectId, req.user._id, req.body);
    res.status(200).json({ success: true, data: project });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteProject = async (req, res) => {
  try {
    await projectService.deleteProject(req.params.projectId, req.user._id);
    // Delete associated materials and document chunks
    await Material.deleteMany({ projectId: req.params.projectId, userId: req.user._id });
    await DocumentChunk.deleteMany({ projectId: req.params.projectId, userId: req.user._id });

    res.status(200).json({ success: true, message: 'Project and associated data deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getProjectDashboard = async (req, res) => {
  try {
    const userId = req.user._id;
    const projectId = req.params.projectId;

    const project = await projectService.getProjectById(projectId, userId);

    // Fetch real counts from MongoDB
    const materialsCount = await Material.countDocuments({ projectId, userId });
    const readyMaterialsCount = await Material.countDocuments({ projectId, userId, status: 'READY' });
    const chunksCount = await DocumentChunk.countDocuments({ projectId, userId });

    let recommendedAction;
    if (materialsCount === 0) {
      recommendedAction = {
        text: 'Upload your first learning material (PDF)',
        reason: 'Add textbooks, slides, or lecture notes to build page-aware knowledge for AI tutoring.',
      };
    } else if (readyMaterialsCount === 0) {
      recommendedAction = {
        text: 'PDF material processing in progress',
        reason: 'Document text extraction and page-aware chunking is underway.',
      };
    } else {
      recommendedAction = {
        text: `Knowledge base active (${chunksCount} page chunks stored)`,
        reason: 'Ready for RAG embeddings and grounded AI tutoring in Phase 4 & 5.',
      };
    }

    res.status(200).json({
      success: true,
      data: {
        project,
        materialsCount,
        readyMaterialsCount,
        chunksCount,
        conceptsCount: 0,
        averageMastery: 0,
        recentActivity: [],
        recommendedAction,
      },
    });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};
