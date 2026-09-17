import Project from '../models/Project.js';
import Space from '../models/Space.js';

export const getProjectsBySpace = async (spaceId, userId) => {
  return await Project.find({ spaceId, userId }).sort({ updatedAt: -1 });
};

export const createProject = async (userId, spaceId, data) => {
  // Ensure space exists and belongs to user
  const space = await Space.findOne({ _id: spaceId, userId });
  if (!space) {
    throw new Error('Space not found or unauthorized');
  }

  return await Project.create({
    userId,
    spaceId,
    name: data.name,
    description: data.description || '',
    learningGoal: data.learningGoal || '',
    status: data.status || 'ACTIVE',
  });
};

export const getProjectById = async (projectId, userId) => {
  const project = await Project.findOne({ _id: projectId, userId }).populate('spaceId', 'name visualCustomization');
  if (!project) {
    throw new Error('Project not found');
  }
  return project;
};

export const updateProject = async (projectId, userId, data) => {
  const project = await Project.findOneAndUpdate(
    { _id: projectId, userId },
    { $set: data },
    { new: true, runValidators: true }
  );
  if (!project) {
    throw new Error('Project not found');
  }
  return project;
};

export const deleteProject = async (projectId, userId) => {
  const project = await Project.findOneAndDelete({ _id: projectId, userId });
  if (!project) {
    throw new Error('Project not found');
  }
  return project;
};

export const getRecentProjects = async (userId, limit = 5) => {
  return await Project.find({ userId })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .populate('spaceId', 'name visualCustomization');
};
