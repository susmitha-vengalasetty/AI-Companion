import Space from '../models/Space.js';
import Project from '../models/Project.js';

/**
 * Middleware to verify that the logged-in user owns the requested Space.
 * Expects `req.params.spaceId` or `req.body.spaceId`.
 */
export const verifySpaceOwnership = async (req, res, next) => {
  try {
    const spaceId = req.params.spaceId || req.body.spaceId;
    
    if (!spaceId) {
      return res.status(400).json({ success: false, message: 'Space ID is required for ownership check' });
    }

    const space = await Space.findOne({ _id: spaceId, userId: req.user._id });
    
    if (!space) {
      return res.status(404).json({ success: false, message: 'Space not found or unauthorized access' });
    }

    req.space = space;
    next();
  } catch (error) {
    return res.status(500).json({ success: false, message: `Space authorization error: ${error.message}` });
  }
};

/**
 * Middleware to verify that the logged-in user owns the requested Project.
 * Expects `req.params.projectId` or `req.body.projectId`.
 */
export const verifyProjectOwnership = async (req, res, next) => {
  try {
    const projectId = req.params.projectId || req.body.projectId;

    if (!projectId) {
      return res.status(400).json({ success: false, message: 'Project ID is required for ownership check' });
    }

    const project = await Project.findOne({ _id: projectId, userId: req.user._id });

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found or unauthorized access' });
    }

    req.project = project;
    next();
  } catch (error) {
    return res.status(500).json({ success: false, message: `Project authorization error: ${error.message}` });
  }
};
