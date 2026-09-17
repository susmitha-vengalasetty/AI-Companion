import Quiz from '../models/Quiz.js';
import QuizAttempt from '../models/QuizAttempt.js';
import DocumentChunk from '../models/DocumentChunk.js';
import Project from '../models/Project.js';
import Concept from '../models/Concept.js';
import Mastery from '../models/Mastery.js';
import Recommendation from '../models/Recommendation.js';
import LearningEvent from '../models/LearningEvent.js';
import { generateAdaptiveQuizFromChunks } from '../services/aiService.js';

export const generateQuiz = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { projectId } = req.params;
    const { count = 4 } = req.body;

    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found or unauthorized.' });
    }

    const chunks = await DocumentChunk.find({ userId, projectId }).populate('materialId', 'fileName');
    if (!chunks || chunks.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No processed PDF materials available. Please upload PDF documents first.',
      });
    }

    // Shuffle and pick chunks
    const shuffled = [...chunks].sort(() => 0.5 - Math.random());
    const selectedChunks = shuffled.slice(0, Math.min(chunks.length, count));

    // Now async: questions come from Gemini with validated structured output,
    // not from string templates. Throws if Gemini is unconfigured or the output
    // fails validation - no fake questions are ever persisted.
    const generatedQuestions = await generateAdaptiveQuizFromChunks(selectedChunks, count);

    const quiz = await Quiz.create({
      userId,
      projectId,
      title: `${project.name} Knowledge Check`,
      difficulty: 'ADAPTIVE',
      questions: generatedQuestions,
      totalQuestions: generatedQuestions.length,
    });

    await LearningEvent.create({
      userId,
      projectId,
      eventType: 'TAKE_QUIZ',
      description: `Generated ${generatedQuestions.length}-question adaptive quiz`,
    });

    return res.status(201).json({
      success: true,
      quiz,
    });
  } catch (error) {
    next(error);
  }
};

export const submitQuiz = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { projectId, quizId } = req.params;
    const { answers = [] } = req.body; // array of { questionId, userAnswer }

    const quiz = await Quiz.findOne({ _id: quizId, userId, projectId });
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found.' });
    }

    let correctCount = 0;
    const evaluatedAnswers = [];

    for (const q of quiz.questions) {
      const userAnsObj = answers.find((a) => String(a.questionId) === String(q._id));
      const userAnswer = userAnsObj ? userAnsObj.userAnswer : '';

      let isCorrect = false;
      if (q.type === 'MCQ') {
        isCorrect = userAnswer.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
      } else {
        // Open-ended checking keyword overlap
        const normUser = userAnswer.toLowerCase();
        const normCorrect = q.correctAnswer.toLowerCase();
        isCorrect = normUser.length > 5 && (normUser.includes(q.conceptName.toLowerCase()) || normCorrect.includes(normUser.slice(0, 10)));
      }

      if (isCorrect) correctCount += 1;

      evaluatedAnswers.push({
        questionId: q._id,
        userAnswer,
        isCorrect,
        scoreAwarded: isCorrect ? 100 : 0,
        feedback: isCorrect ? 'Correct! Verified against document source.' : `Incorrect. Expected concept: ${q.correctAnswer}`,
        explanation: q.explanation,
        citationText: q.citationText,
      });

      // Update concept and mastery level
      let concept = await Concept.findOne({ userId, projectId, name: q.conceptName });
      if (!concept) {
        concept = await Concept.create({
          userId,
          projectId,
          name: q.conceptName,
          description: q.questionText.slice(0, 100),
        });
      }

      let mastery = await Mastery.findOne({ userId, projectId, conceptId: concept._id });
      if (!mastery) {
        mastery = new Mastery({
          userId,
          projectId,
          conceptId: concept._id,
          conceptName: q.conceptName,
          score: 50,
          status: 'LEARNING',
        });
      }

      mastery.totalAttempts += 1;
      if (isCorrect) {
        mastery.correctAnswers += 1;
        mastery.score = Math.min(100, mastery.score + 20);
      } else {
        mastery.score = Math.max(0, mastery.score - 15);
      }

      if (mastery.score >= 85) mastery.status = 'MASTERED';
      else if (mastery.score < 40) mastery.status = 'WEAK';
      else mastery.status = 'LEARNING';

      mastery.lastAssessedAt = new Date();
      await mastery.save();

      // Create recommendation if weak
      if (mastery.status === 'WEAK') {
        await Recommendation.create({
          userId,
          projectId,
          type: 'PRACTICE_WEAK_CONCEPT',
          title: `Review Weak Concept: ${q.conceptName}`,
          description: `You scored low on ${q.conceptName}. Review Page ${q.sourcePage} of ${q.sourceFileName}.`,
          targetConcept: q.conceptName,
          sourceFileName: q.sourceFileName,
          targetPage: q.sourcePage,
          priority: 'HIGH',
        });
      }
    }

    const overallScore = Math.round((correctCount / quiz.questions.length) * 100);

    const attempt = await QuizAttempt.create({
      userId,
      projectId,
      quizId: quiz._id,
      score: overallScore,
      totalQuestions: quiz.questions.length,
      correctCount,
      answers: evaluatedAnswers,
    });

    quiz.isCompleted = true;
    await quiz.save();

    return res.status(200).json({
      success: true,
      attempt,
    });
  } catch (error) {
    next(error);
  }
};

export const getQuizHistory = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { projectId } = req.params;

    const attempts = await QuizAttempt.find({ userId, projectId }).sort({ completedAt: -1 }).limit(10);
    return res.status(200).json({ success: true, attempts });
  } catch (error) {
    next(error);
  }
};
