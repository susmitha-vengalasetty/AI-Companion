import DocumentChunk from '../models/DocumentChunk.js';
import Project from '../models/Project.js';
import { generateEmbedding } from './embeddingService.js';
import { isSmallTalk, generateSmallTalkAnswer } from './aiService.js';
import { ragConfig, getEmbeddingIdentity } from '../config/ragConfig.js';

const STOP_WORDS = new Set([
  'what', 'is', 'are', 'was', 'were', 'the', 'a', 'an', 'in', 'on', 'at', 'of',
  'for', 'to', 'from', 'with', 'by', 'about', 'can', 'you', 'tell', 'me',
  'explain', 'define', 'how', 'why', 'where', 'which', 'who', 'does', 'do',
  'did', 'this', 'that', 'these', 'those', 'there', 'here', 'give', 'show',
]);

/**
 * Cosine similarity. Higher = more similar. Range [-1, 1] for real embeddings.
 *
 * Dimension mismatch now THROWS rather than returning 0. Previously it returned
 * 0 silently, which meant a corrupted index looked like "no relevant results"
 * instead of the configuration error it actually was.
 */
export function calculateCosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length === 0 || vecB.length === 0) {
    throw new Error('SIMILARITY_INVALID_INPUT: one or both vectors are empty');
  }
  if (vecA.length !== vecB.length) {
    throw new Error(
      `SIMILARITY_DIMENSION_MISMATCH: query vector has ${vecA.length} dimensions but chunk vector has ${vecB.length}. ` +
        'The index was built with a different embedding model. Re-index this project.'
    );
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Lexical overlap score in [0, 1]: fraction of the query's content terms that
 * appear in the chunk. Used only as a small tie-breaker (see ragConfig.lexicalWeight).
 */
function lexicalScore(subjectTerms, chunkText) {
  if (subjectTerms.length === 0) return 0;
  const lower = chunkText.toLowerCase();
  const hits = subjectTerms.filter((t) => lower.includes(t)).length;
  return hits / subjectTerms.length;
}

/**
 * Project-scoped semantic retrieval.
 *
 * SCORING CHANGE
 * --------------
 * The previous implementation multiplied the cosine score by 0.25 when no query
 * keyword appeared in the chunk, and blended in a keyword ratio otherwise. That
 * was a band-aid over broken embeddings: it made the reported "similarity"
 * a number with no consistent mathematical meaning, so no threshold could be
 * interpreted. Scores are now a documented, reproducible blend:
 *
 *     score = (1 - lexicalWeight) * cosine + lexicalWeight * lexicalOverlap
 *
 * with lexicalWeight defaulting to 0.15. Both terms are in [0, 1] for real
 * embeddings on this corpus, so the threshold is interpretable.
 */
export const searchProjectKnowledge = async ({
  userId,
  projectId,
  query,
  topK = ragConfig.topK,
  minConfidence = ragConfig.minSimilarity,
}) => {
  // Ownership is re-verified here, not trusted from the caller, so this service
  // is safe even if a future route forgets the ownership middleware.
  const project = await Project.findOne({ _id: projectId, userId });
  if (!project) {
    const err = new Error('Project not found or unauthorized access');
    err.statusCode = 404;
    throw err;
  }

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return { query: '', results: [], hasEvidence: false, message: 'Empty search query provided.' };
  }

  const cleanQuery = query.trim();

  if (isSmallTalk(cleanQuery)) {
    return {
      query: cleanQuery,
      topK,
      minConfidence,
      bestScore: null,
      hasEvidence: false,
      isSmallTalk: true,
      answer: generateSmallTalkAnswer(cleanQuery),
      results: [],
      message: 'Greeting detected - no retrieval performed.',
    };
  }

  const subjectTerms = cleanQuery
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));

  const queryVector = await generateEmbedding(cleanQuery);

  // Strictly scoped to this user AND this project. Only the fields needed for
  // scoring and citation are selected.
  const candidateChunks = await DocumentChunk.find({ userId, projectId })
    .select('text pageNumber chunkIndex embedding embeddingModel materialId metadata')
    .populate('materialId', 'fileName')
    .lean();

  if (candidateChunks.length === 0) {
    return {
      query: cleanQuery,
      results: [],
      hasEvidence: false,
      message: 'No learning materials have been processed for this project yet.',
    };
  }

  const activeIdentity = getEmbeddingIdentity();
  const scored = [];
  let skippedNoEmbedding = 0;
  let skippedWrongModel = 0;

  for (const chunk of candidateChunks) {
    if (!chunk.embedding || chunk.embedding.length === 0) {
      skippedNoEmbedding += 1;
      continue;
    }

    // Guard against a corpus indexed with a different model. Comparing across
    // models is meaningless even when dimensions happen to match.
    if (chunk.embeddingModel && chunk.embeddingModel !== activeIdentity) {
      skippedWrongModel += 1;
      continue;
    }

    if (chunk.embedding.length !== queryVector.length) {
      skippedWrongModel += 1;
      continue;
    }

    const cosine = calculateCosineSimilarity(queryVector, chunk.embedding);
    const lexical = lexicalScore(subjectTerms, chunk.text);
    const score = (1 - ragConfig.lexicalWeight) * cosine + ragConfig.lexicalWeight * lexical;

    scored.push({
      chunkId: String(chunk._id),
      materialId: chunk.materialId ? String(chunk.materialId._id) : null,
      fileName: chunk.materialId?.fileName || chunk.metadata?.fileName || 'Document',
      pageNumber: chunk.pageNumber,
      chunkIndex: chunk.chunkIndex,
      text: chunk.text,
      cosine: parseFloat(cosine.toFixed(4)),
      lexicalOverlap: parseFloat(lexical.toFixed(4)),
      score: parseFloat(score.toFixed(4)),
    });
  }

  if (skippedWrongModel > 0) {
    throw new Error(
      `INDEX_STALE: The stored RAG index was generated using another embedding model. ` +
        `${skippedWrongModel} of ${candidateChunks.length} chunks do not match the configured model ` +
        `("${activeIdentity}"). Run: node scripts/reindex.mjs --all`
    );
  }

  scored.sort((a, b) => b.score - a.score);

  // Threshold BEFORE slicing, so topK never pads the response with chunks that
  // failed the relevance bar just to fill the list.
  const relevant = scored.filter((r) => r.score >= minConfidence).slice(0, topK);
  const bestScore = scored.length > 0 ? scored[0].score : 0;
  const hasEvidence = relevant.length > 0;

  if (ragConfig.debugRetrieval) {
    console.log(
      `[Retrieval] project=${projectId} candidates=${scored.length} ` +
        `noEmbedding=${skippedNoEmbedding} best=${bestScore} threshold=${minConfidence} ` +
        `accepted=${relevant.length} topPages=[${scored.slice(0, 3).map((r) => r.pageNumber).join(',')}]`
    );
  }

  return {
    query: cleanQuery,
    topK,
    minConfidence,
    embeddingModel: activeIdentity,
    candidatesScored: scored.length,
    bestScore,
    hasEvidence,
    results: relevant,
    code: hasEvidence ? 'OK' : 'NO_RELEVANT_CONTEXT',
    message: hasEvidence
      ? `Retrieved ${relevant.length} chunk(s) above the relevance threshold.`
      : 'No sufficiently relevant information was found in the uploaded study materials.',
  };
};
