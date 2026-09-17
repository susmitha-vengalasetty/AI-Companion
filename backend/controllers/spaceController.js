import * as spaceService from '../services/spaceService.js';

export const getSpaces = async (req, res) => {
  try {
    const spaces = await spaceService.getUserSpaces(req.user._id);
    res.status(200).json({ success: true, count: spaces.length, data: spaces });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createSpace = async (req, res) => {
  try {
    const { name, description, visualCustomization } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Space name is required' });
    }
    const space = await spaceService.createSpace(req.user._id, { name, description, visualCustomization });
    res.status(201).json({ success: true, data: space });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getSpace = async (req, res) => {
  try {
    const space = await spaceService.getSpaceById(req.params.spaceId, req.user._id);
    res.status(200).json({ success: true, data: space });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

export const updateSpace = async (req, res) => {
  try {
    const space = await spaceService.updateSpace(req.params.spaceId, req.user._id, req.body);
    res.status(200).json({ success: true, data: space });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteSpace = async (req, res) => {
  try {
    await spaceService.deleteSpace(req.params.spaceId, req.user._id);
    res.status(200).json({ success: true, message: 'Space deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
