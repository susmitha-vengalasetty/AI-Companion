import Space from '../models/Space.js';
import Project from '../models/Project.js';
import { getRecentProjects } from '../services/projectService.js';

export const getHomeDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    const totalSpaces = await Space.countDocuments({ userId });
    const totalProjects = await Project.countDocuments({ userId });
    
    // Most recent space owned by user
    const latestSpace = await Space.findOne({ userId }).sort({ updatedAt: -1 });

    // Most recent project owned by user
    const recentProjects = await getRecentProjects(userId, 5);
    const continueLearning = recentProjects.length > 0 ? recentProjects[0] : null;

    let recommendedNextAction;
    if (continueLearning) {
      recommendedNextAction = {
        title: `Continue learning in ${continueLearning.name}`,
        description: continueLearning.learningGoal ? `Goal: ${continueLearning.learningGoal}` : 'Resume your study session',
        projectId: continueLearning._id,
      };
    } else if (latestSpace) {
      recommendedNextAction = {
        title: `Create a Project in "${latestSpace.name}"`,
        description: 'Projects hold learning materials, AI tutoring sessions, and adaptive quizzes.',
        spaceId: latestSpace._id,
      };
    } else {
      recommendedNextAction = {
        title: 'Create your first Space',
        description: 'Organize subjects, certification prep, or courses into distinct learning spaces.',
      };
    }

    res.status(200).json({
      success: true,
      data: {
        totalSpaces,
        totalProjects,
        latestSpace,
        continueLearning,
        recentProjects,
        recommendedNextAction,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
