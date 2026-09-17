import Space from '../models/Space.js';
import Project from '../models/Project.js';

export const getUserSpaces = async (userId) => {
  return await Space.find({ userId }).sort({ updatedAt: -1 });
};

export const createSpace = async (userId, data) => {
  return await Space.create({
    userId,
    name: data.name,
    description: data.description || '',
    visualCustomization: data.visualCustomization || { color: '#3B82F6', icon: 'folder' },
  });
};

export const getSpaceById = async (spaceId, userId) => {
  const space = await Space.findOne({ _id: spaceId, userId });
  if (!space) {
    throw new Error('Space not found');
  }
  return space;
};

export const updateSpace = async (spaceId, userId, data) => {
  const space = await Space.findOneAndUpdate(
    { _id: spaceId, userId },
    { $set: data },
    { new: true, runValidators: true }
  );
  if (!space) {
    throw new Error('Space not found');
  }
  return space;
};

export const deleteSpace = async (spaceId, userId) => {
  const space = await Space.findOneAndDelete({ _id: spaceId, userId });
  if (!space) {
    throw new Error('Space not found');
  }
  // Delete all associated projects for this space
  await Project.deleteMany({ spaceId, userId });
  return space;
};
