import { searchProjectKnowledge } from './retrievalService.js';

export const buildRAGContext = async ({ userId, projectId, query, topK = 5, minConfidence = 0.15 }) => {
  const retrievalResult = await searchProjectKnowledge({
    userId,
    projectId,
    query,
    topK,
    minConfidence,
  });

  if (!retrievalResult.hasEvidence) {
    return {
      query: retrievalResult.query,
      hasEvidence: false,
      groundedContext: '',
      citations: [],
      sources: [],
      retrievedChunks: [],
      bestScore: retrievalResult.bestScore,
      message: retrievalResult.message,
    };
  }

  // Format retrieved chunks into clean grounded context with source citations
  const contextParts = [];
  const citations = [];
  const sourcesMap = new Map();
  const sources = [];
  const retrievedChunks = [];

  retrievalResult.results.forEach((chunk, index) => {
    const citationTag = `[Source: ${chunk.fileName} — Page ${chunk.pageNumber}]`;
    contextParts.push(`--- Evidence Block ${index + 1} ${citationTag} ---\n${chunk.text}`);

    citations.push({
      fileName: chunk.fileName,
      pageNumber: chunk.pageNumber,
      chunkIndex: chunk.chunkIndex,
      score: chunk.score,
      citationText: `Source: ${chunk.fileName} — Page ${chunk.pageNumber}`,
    });

    const sourceKey = `${chunk.fileName}:P${chunk.pageNumber}`;
    if (!sourcesMap.has(sourceKey)) {
      sourcesMap.set(sourceKey, true);
      sources.push({
        documentName: chunk.fileName,
        page: chunk.pageNumber,
        citationText: `${chunk.fileName}, p. ${chunk.pageNumber}`,
      });
    }

    retrievedChunks.push({
      documentName: chunk.fileName,
      page: chunk.pageNumber,
      chunkId: String(chunk.chunkId || index + 1),
      similarity: chunk.score,
      text: chunk.text,
    });
  });

  const groundedContext = contextParts.join('\n\n');

  return {
    query: retrievalResult.query,
    hasEvidence: true,
    groundedContext,
    citations,
    sources,
    retrievedChunks,
    bestScore: retrievalResult.bestScore,
    message: `Built grounded context with ${citations.length} page citations.`,
  };
};
