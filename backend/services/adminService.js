import mongoose from 'mongoose';
import User from '../models/User.js';
import Space from '../models/Space.js';
import Project from '../models/Project.js';
import Material from '../models/Material.js';
import DocumentChunk from '../models/DocumentChunk.js';
import Conversation from '../models/Conversation.js';
import QuizAttempt from '../models/QuizAttempt.js';
import LearningEvent from '../models/LearningEvent.js';
import AIUsage from '../models/AIUsage.js';
import Job from '../models/Job.js';
import { ragConfig, geminiConfig } from '../config/ragConfig.js';

export const getOverviewStats = async () => {
  const [
    totalUsers,
    totalSpaces,
    totalProjects,
    totalMaterials,
    totalChunks,
    totalTutorConversations,
    totalQuizAttempts,
  ] = await Promise.all([
    User.countDocuments(),
    Space.countDocuments(),
    Project.countDocuments(),
    Material.countDocuments(),
    DocumentChunk.countDocuments(),
    Conversation.countDocuments(),
    QuizAttempt.countDocuments(),
  ]);

  return {
    totalUsers,
    totalSpaces,
    totalProjects,
    totalMaterials,
    totalChunks,
    totalTutorConversations,
    totalQuizAttempts,
  };
};

export const getUsersList = async ({ page = 1, limit = 10 }) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  const [users, total] = await Promise.all([
    User.find().select('-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    User.countDocuments(),
  ]);

  // Aggregate user spaces and projects counts efficiently
  const userIds = users.map((u) => u._id);

  const [spacesCountMap, projectsCountMap] = await Promise.all([
    Space.aggregate([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]),
    Project.aggregate([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]),
  ]);

  const spacesMap = new Map(spacesCountMap.map((item) => [String(item._id), item.count]));
  const projectsMap = new Map(projectsCountMap.map((item) => [String(item._id), item.count]));

  const enrichedUsers = users.map((u) => {
    const isAdminByEnv = Boolean(
      process.env.ADMIN_EMAIL &&
        u.email &&
        u.email.toLowerCase() === process.env.ADMIN_EMAIL.trim().toLowerCase()
    );
    return {
      ...u,
      role: isAdminByEnv ? 'admin' : u.role || 'user',
      spacesCount: spacesMap.get(String(u._id)) || 0,
      projectsCount: projectsMap.get(String(u._id)) || 0,
    };
  });

  return {
    users: enrichedUsers,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum) || 1,
    },
  };
};

export const getLearningActivity = async ({ limit = 20 }) => {
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const events = await LearningEvent.find()
    .sort({ timestamp: -1, createdAt: -1 })
    .limit(limitNum)
    .populate('userId', 'name email')
    .populate('projectId', 'name')
    .lean();

  return events;
};

export const getAIUsageStats = async () => {
  const breakdown = await AIUsage.aggregate([
    {
      $group: {
        _id: '$feature',
        totalPromptTokens: { $sum: '$promptTokens' },
        totalCompletionTokens: { $sum: '$completionTokens' },
        totalTokens: { $sum: '$totalTokens' },
        totalQueries: { $sum: '$queryCount' },
      },
    },
  ]);

  const totalTokensAll = breakdown.reduce((acc, curr) => acc + (curr.totalTokens || 0), 0);
  const totalQueriesAll = breakdown.reduce((acc, curr) => acc + (curr.totalQueries || 0), 0);

  return {
    totalTokens: totalTokensAll,
    totalQueries: totalQueriesAll,
    breakdown,
  };
};

export const getMaterialProcessingStats = async () => {
  const [statusCounts, recentJobs] = await Promise.all([
    Material.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),
    Job.find().sort({ createdAt: -1 }).limit(10).lean(),
  ]);

  const statusMap = {
    QUEUED: 0,
    PROCESSING: 0,
    READY: 0,
    FAILED: 0,
  };

  statusCounts.forEach((item) => {
    if (item._id && statusMap[item._id] !== undefined) {
      statusMap[item._id] = item.count;
    }
  });

  return {
    materialsByStatus: statusMap,
    recentJobs,
  };
};

export const getSystemHealth = async () => {
  const dbStateMap = {
    0: 'DISCONNECTED',
    1: 'CONNECTED',
    2: 'CONNECTING',
    3: 'DISCONNECTING',
  };

  const dbState = dbStateMap[mongoose.connection.readyState] || 'UNKNOWN';

  return {
    status: 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      status: dbState,
      host: mongoose.connection.host || 'MongoDB Atlas',
    },
    aiProvider: {
      provider: ragConfig.embeddingProvider,
      embeddingModel: ragConfig.embeddingModel,
      requestedDimension: ragConfig.requestedDimension,
      llmModel: geminiConfig.model,
      isApiKeyConfigured: Boolean(geminiConfig.apiKey),
    },
    backgroundJobsInfrastructure: {
      type: 'MongoDB-backed async queue (Job collection)',
      redisBullMQ: 'Not used (Direct Async Handler)',
    },
  };
};
