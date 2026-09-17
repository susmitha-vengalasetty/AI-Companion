import Conversation from '../models/Conversation.js';
import Project from '../models/Project.js';
import LearningEvent from '../models/LearningEvent.js';
import AIUsage from '../models/AIUsage.js';
import { buildRAGContext } from '../services/ragService.js';
import { generateTutorAnswer, isSmallTalk, generateSmallTalkAnswer } from '../services/aiService.js';

/**
 * Get all conversations for a specific project & user
 */
export const getConversations = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { projectId } = req.params;

    const conversations = await Conversation.find({ userId, projectId })
      .select('_id title lastMessageSnippet messages updatedAt createdAt')
      .sort({ updatedAt: -1 });

    const formatted = conversations.map((c) => ({
      _id: c._id,
      title: c.title,
      lastMessageSnippet: c.lastMessageSnippet || (c.messages.length > 0 ? c.messages[c.messages.length - 1].content.slice(0, 80) : 'No messages yet'),
      messageCount: c.messages.length,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    return res.status(200).json({ success: true, conversations: formatted });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new conversation thread
 */
export const createConversation = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { projectId } = req.params;
    const { title } = req.body;

    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found or unauthorized.' });
    }

    const conversation = await Conversation.create({
      userId,
      projectId,
      title: title || 'New Tutor Discussion',
      lastMessageSnippet: '',
      messages: [],
    });

    return res.status(201).json({ success: true, conversation });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single conversation with full message history
 */
export const getConversationById = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { projectId, conversationId } = req.params;

    const conversation = await Conversation.findOne({ _id: conversationId, userId, projectId });
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found.' });
    }

    return res.status(200).json({ success: true, conversation });
  } catch (error) {
    next(error);
  }
};

/**
 * Ask question inside a specific conversation thread (or auto-create if missing)
 */
export const askInConversation = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { projectId } = req.params;
    const conversationId = req.params.conversationId || req.body.conversationId;
    const { query } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Question prompt is required.' });
    }

    // Verify project ownership
    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found or unauthorized.' });
    }

    let conversation;
    if (conversationId) {
      conversation = await Conversation.findOne({ _id: conversationId, userId, projectId });
    }

    if (!conversation) {
      // Find latest or create new conversation
      conversation = await Conversation.findOne({ userId, projectId }).sort({ updatedAt: -1 });
      if (!conversation) {
        conversation = new Conversation({
          userId,
          projectId,
          title: query.trim().slice(0, 40) + '...',
          messages: [],
        });
      }
    }

    // Set title if default
    if (conversation.title === 'New Tutor Discussion' || conversation.messages.length === 0) {
      conversation.title = query.trim().slice(0, 45) + (query.trim().length > 45 ? '...' : '');
    }

    // Small-Talk Detection: Handle greetings & casual chat without performing document RAG retrieval
    if (isSmallTalk(query.trim())) {
      const smallTalkReply = generateSmallTalkAnswer(query.trim());

      conversation.messages.push(
        { role: 'user', content: query.trim(), citations: [], sources: [], retrievedChunks: [], isSmallTalk: true, hasEvidence: true },
        { role: 'assistant', content: smallTalkReply, citations: [], sources: [], retrievedChunks: [], isSmallTalk: true, hasEvidence: true }
      );
      conversation.lastMessageSnippet = smallTalkReply.slice(0, 80);
      await conversation.save();

      return res.status(200).json({
        success: true,
        answer: smallTalkReply,
        citations: [],
        sources: [],
        retrievedChunks: [],
        isSmallTalk: true,
        hasEvidence: true,
        conversationId: conversation._id,
        messages: conversation.messages,
      });
    }

    // Build grounded RAG context with evidence retrieval
    const ragResult = await buildRAGContext({
      userId,
      projectId,
      query: query.trim(),
      topK: 5,
      minConfidence: 0.15,
    });

    // Handle unsupported questions
    if (!ragResult.hasEvidence) {
      const unsupportedMessage = 'I cannot answer this question based on the uploaded materials. Please upload relevant documents covering this topic.';

      conversation.messages.push(
        { role: 'user', content: query.trim(), citations: [], sources: [], retrievedChunks: [], hasEvidence: false },
        { role: 'assistant', content: unsupportedMessage, citations: [], sources: [], retrievedChunks: [], hasEvidence: false }
      );
      conversation.lastMessageSnippet = unsupportedMessage.slice(0, 80);
      await conversation.save();

      await LearningEvent.create({
        userId,
        projectId,
        eventType: 'ASK_TUTOR',
        description: `Asked: "${query.trim().slice(0, 50)}" (No Evidence)`,
        metadata: { hasEvidence: false },
      });

      return res.status(200).json({
        success: true,
        answer: unsupportedMessage,
        citations: [],
        sources: [],
        retrievedChunks: [],
        hasEvidence: false,
        bestScore: ragResult.bestScore,
        conversationId: conversation._id,
        messages: conversation.messages,
      });
    }

    // Generate grounded answer
    const tutorResponse = await generateTutorAnswer({
      query: query.trim(),
      groundedContext: ragResult.groundedContext,
      citations: ragResult.citations,
      conversationHistory: conversation.messages,
    });

    conversation.messages.push(
      { role: 'user', content: query.trim(), citations: ragResult.citations, sources: ragResult.sources, retrievedChunks: ragResult.retrievedChunks, hasEvidence: true },
      { role: 'assistant', content: tutorResponse.answer, citations: ragResult.citations, sources: ragResult.sources, retrievedChunks: ragResult.retrievedChunks, hasEvidence: true }
    );
    conversation.lastMessageSnippet = tutorResponse.answer.slice(0, 80);
    await conversation.save();

    // Log Learning Event & AI Usage
    await LearningEvent.create({
      userId,
      projectId,
      eventType: 'ASK_TUTOR',
      description: `Asked: "${query.trim().slice(0, 50)}"`,
      metadata: { citationsCount: ragResult.citations.length },
    });

    await AIUsage.create({
      userId,
      projectId,
      feature: 'TUTOR_ASK',
      promptTokens: Math.round(tutorResponse.promptTokens || 0),
      completionTokens: Math.round(tutorResponse.completionTokens || 0),
      totalTokens: Math.round((tutorResponse.promptTokens || 0) + (tutorResponse.completionTokens || 0)),
      queryCount: 1,
    });

    return res.status(200).json({
      success: true,
      answer: tutorResponse.answer,
      citations: ragResult.citations,
      sources: ragResult.sources,
      retrievedChunks: ragResult.retrievedChunks,
      hasEvidence: true,
      bestScore: ragResult.bestScore,
      conversationId: conversation._id,
      messages: conversation.messages,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a specific conversation thread
 */
export const deleteConversation = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { projectId, conversationId } = req.params;

    const conversation = await Conversation.findOneAndDelete({ _id: conversationId, userId, projectId });
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found or unauthorized.' });
    }

    return res.status(200).json({ success: true, message: 'Conversation deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

/**
 * Backward compatibility route handlers
 */
export const askTutor = askInConversation;
export const getTutorHistory = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { projectId } = req.params;

    const conversation = await Conversation.findOne({ userId, projectId }).sort({ updatedAt: -1 });
    return res.status(200).json({
      success: true,
      messages: conversation ? conversation.messages : [],
      conversationId: conversation ? conversation._id : null,
    });
  } catch (error) {
    next(error);
  }
};

export const clearTutorHistory = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { projectId } = req.params;

    await Conversation.deleteMany({ userId, projectId });
    return res.status(200).json({ success: true, message: 'All project conversation history cleared.' });
  } catch (error) {
    next(error);
  }
};
