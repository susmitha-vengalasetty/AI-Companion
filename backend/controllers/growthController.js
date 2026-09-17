import Mastery from '../models/Mastery.js';
import QuizAttempt from '../models/QuizAttempt.js';
import Recommendation from '../models/Recommendation.js';
import LearningEvent from '../models/LearningEvent.js';
import AIUsage from '../models/AIUsage.js';
import Material from '../models/Material.js';

export const getGrowthMetrics = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { projectId } = req.params;

    const masteries = await Mastery.find({ userId, projectId });
    const quizAttempts = await QuizAttempt.find({ userId, projectId });
    const materials = await Material.find({ userId, projectId });

    const totalConcepts = masteries.length;
    const masteredCount = masteries.filter((m) => m.status === 'MASTERED').length;
    const weakCount = masteries.filter((m) => m.status === 'WEAK').length;
    const learningCount = masteries.filter((m) => m.status === 'LEARNING' || m.status === 'NOT_STARTED').length;

    const overallMasteryScore = totalConcepts > 0
      ? Math.round(masteries.reduce((sum, m) => sum + m.score, 0) / totalConcepts)
      : 0;

    const totalQuizzesTaken = quizAttempts.length;
    const avgQuizScore = totalQuizzesTaken > 0
      ? Math.round(quizAttempts.reduce((sum, q) => sum + q.score, 0) / totalQuizzesTaken)
      : 0;

    return res.status(200).json({
      success: true,
      metrics: {
        overallMasteryScore,
        totalConcepts,
        masteredCount,
        weakCount,
        learningCount,
        totalQuizzesTaken,
        avgQuizScore,
        totalMaterials: materials.length,
        readyMaterials: materials.filter((m) => m.status === 'READY').length,
        studyStreakDays: totalQuizzesTaken > 0 ? Math.min(7, totalQuizzesTaken + 1) : 1,
      },
      masteries,
    });
  } catch (error) {
    next(error);
  }
};

export const getRecommendations = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { projectId } = req.params;

    let recommendations = await Recommendation.find({ userId, projectId, isDismissed: false }).sort({ priority: 1, createdAt: -1 });

    // Fallback default recommendations if empty
    if (recommendations.length === 0) {
      recommendations = [
        {
          _id: 'rec_1',
          title: 'Start Grounded Tutor Chat',
          description: 'Ask doubts to your AI Tutor grounded strictly in project PDFs.',
          type: 'GENERAL_STUDY',
          priority: 'HIGH',
        },
        {
          _id: 'rec_2',
          title: 'Take an Adaptive Practice Quiz',
          description: 'Test your understanding with dynamic MCQs and open-ended questions.',
          type: 'RETAKE_QUIZ',
          priority: 'MEDIUM',
        },
      ];
    }

    return res.status(200).json({ success: true, recommendations });
  } catch (error) {
    next(error);
  }
};

export const getAnalytics = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { projectId } = req.params;

    const events = await LearningEvent.find({ userId, projectId }).sort({ timestamp: -1 }).limit(20);
    const usageRecords = await AIUsage.find({ userId, projectId });

    const totalTokens = usageRecords.reduce((sum, u) => sum + (u.totalTokens || 0), 0);
    const totalQueries = usageRecords.reduce((sum, u) => sum + (u.queryCount || 1), 0);

    return res.status(200).json({
      success: true,
      analytics: {
        totalTokens,
        totalQueries,
        events,
      },
    });
  } catch (error) {
    next(error);
  }
};
