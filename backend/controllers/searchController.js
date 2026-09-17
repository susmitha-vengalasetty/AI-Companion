import { searchProjectKnowledge } from '../services/retrievalService.js';
import { buildRAGContext } from '../services/ragService.js';
import { generateTutorAnswer } from '../services/aiService.js';

export const searchProjectKnowledgeHandler = async (req, res) => {
  try {
    const { query, topK, minConfidence } = req.body;
    const { projectId } = req.params;

    if (!query) {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    const data = await searchProjectKnowledge({
      userId: req.user._id,
      projectId,
      query,
      topK: topK ? parseInt(topK, 10) : 5,
      minConfidence: minConfidence ? parseFloat(minConfidence) : 0.28,
    });

    if (data.hasEvidence && !data.isSmallTalk && data.results.length > 0) {
      const ragCtx = await buildRAGContext({
        userId: req.user._id,
        projectId,
        query: query.trim(),
        topK: topK ? parseInt(topK, 10) : 5,
        minConfidence: 0.28,
      });

      const tutorAns = await generateTutorAnswer({
        query: query.trim(),
        groundedContext: ragCtx.groundedContext,
        citations: ragCtx.citations,
      });

      data.answer = tutorAns.answer;
      data.sources = ragCtx.sources;
    }

    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getRAGContextHandler = async (req, res) => {
  try {
    const { query, topK, minConfidence } = req.body;
    const { projectId } = req.params;

    if (!query) {
      return res.status(400).json({ success: false, message: 'Query is required' });
    }

    const data = await buildRAGContext({
      userId: req.user._id,
      projectId,
      query,
      topK: topK ? parseInt(topK, 10) : 5,
      minConfidence: minConfidence ? parseFloat(minConfidence) : 0.28,
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
