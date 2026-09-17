import * as adminService from '../services/adminService.js';

export const getOverview = async (req, res) => {
  try {
    const data = await adminService.getOverviewStats();
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getUsers = async (req, res) => {
  try {
    const data = await adminService.getUsersList(req.query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getActivity = async (req, res) => {
  try {
    const data = await adminService.getLearningActivity(req.query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAIUsage = async (req, res) => {
  try {
    const data = await adminService.getAIUsageStats();
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getProcessingStats = async (req, res) => {
  try {
    const data = await adminService.getMaterialProcessingStats();
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getHealth = async (req, res) => {
  try {
    const data = await adminService.getSystemHealth();
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
