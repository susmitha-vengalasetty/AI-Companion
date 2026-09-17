import dotenv from 'dotenv';

dotenv.config();

/**
 * Centralized AI / RAG configuration - Google Gemini only.
 *
 * MIGRATION NOTE (xAI/Grok -> Gemini)
 * -----------------------------------
 * This project previously used xAI (Grok) for the LLM and xAI/OpenAI for
 * embeddings. Both are removed. There is no Grok, OpenAI or local fallback
 * anywhere in the AI path: if Gemini is unconfigured or failing, the affected
 * feature raises a clear error instead of degrading into fake output.
 *
 * MODEL CHOICES (verified against Google docs, September 2026)
 * -----------------------------------------------------------
 * LLM: gemini-3-flash
 *   Google's recommended free-tier model. Pro models moved to paid-only on
 *   1 April 2026, so a Pro default would silently require billing.
 *
 * Embeddings: gemini-embedding-2
 *   Generally available, 8,192 input tokens, output dimensions configurable
 *   from 128 to 3,072 (Google recommends 768, 1536 or 3072).
 *   text-embedding-004 is NOT used - it was retired on 14 January 2026.
 *   embedding-001 was retired on 14 August 2025.
 *
 * Free tier is rate-limited, not unlimited, and limits change. See README.
 */

/** Dimensions Google recommends for gemini-embedding-2. */
export const RECOMMENDED_DIMENSIONS = [768, 1536, 3072];

/**
 * DIMENSION CHOICE
 * ----------------
 * Default 768: Google's recommended "sweet spot". At 3072 this corpus (~730
 * chunks) would store ~2.2M floats, and every query would score all of them in
 * Node on an 8 GB laptop. 768 cuts storage and scoring cost 4x with minimal
 * retrieval-quality loss. Configurable, and NOT trusted blindly - the actual
 * returned length is validated against it on every single vector.
 */
const requestedDimension = process.env.EMBEDDING_DIMENSIONS
  ? parseInt(process.env.EMBEDDING_DIMENSIONS, 10)
  : 768;

/**
 * THRESHOLD REASONING
 * -------------------
 * The correct minimum-similarity value is model-specific and cannot be carried
 * over from a different provider. The previous default (0.35) was derived for
 * OpenAI text-embedding-3-small and is NOT valid for Gemini.
 *
 * Google publishes no score distribution for gemini-embedding-2, so the default
 * below is an UNCALIBRATED starting point. Calibrate it for real with:
 *
 *     node scripts/evaluate-retrieval.mjs
 *
 * That script runs known-answerable and known-unanswerable queries against your
 * actual corpus and prints every score, so you can set RAG_MIN_SIMILARITY
 * between the two clusters. Do not treat the default as validated.
 */
const UNCALIBRATED_DEFAULT_MIN_SIMILARITY = 0.55;

const embeddingProvider = (process.env.EMBEDDING_PROVIDER || 'gemini').toLowerCase();

export const ragConfig = {
  embeddingProvider,
  embeddingModel: process.env.EMBEDDING_MODEL || 'gemini-embedding-2',
  requestedDimension,

  minSimilarity: process.env.RAG_MIN_SIMILARITY
    ? parseFloat(process.env.RAG_MIN_SIMILARITY)
    : UNCALIBRATED_DEFAULT_MIN_SIMILARITY,

  isThresholdCalibrated: Boolean(process.env.RAG_MIN_SIMILARITY),

  topK: process.env.RAG_TOP_K ? parseInt(process.env.RAG_TOP_K, 10) : 5,

  /**
   * Free-tier friendly. batchEmbedContents counts as ONE request regardless of
   * batch size, so a small batch plus a pause between batches keeps both RPM
   * and TPM comfortably inside free-tier limits. ~730 chunks becomes ~37
   * requests rather than 730.
   */
  embeddingBatchSize: process.env.RAG_EMBEDDING_BATCH_SIZE
    ? parseInt(process.env.RAG_EMBEDDING_BATCH_SIZE, 10)
    : 20,
  embeddingBatchDelayMs: process.env.RAG_EMBEDDING_BATCH_DELAY_MS
    ? parseInt(process.env.RAG_EMBEDDING_BATCH_DELAY_MS, 10)
    : 1500,

  /**
   * RETRY / BACKOFF TUNING for a single batch that just got a 429.
   * Different from embeddingBatchDelayMs above, which is the pacing pause
   * BETWEEN batches that already succeeded. This is how hard we back off
   * when one batch fails. Doubles each attempt, capped at the max so a bad
   * config can't make the process hang indefinitely.
   */
  embeddingRetryBaseDelayMs: process.env.RAG_EMBEDDING_RETRY_BASE_MS
    ? parseInt(process.env.RAG_EMBEDDING_RETRY_BASE_MS, 10)
    : 3000,
  embeddingRetryMaxDelayMs: process.env.RAG_EMBEDDING_RETRY_MAX_MS
    ? parseInt(process.env.RAG_EMBEDDING_RETRY_MAX_MS, 10)
    : 60000,
  embeddingMaxRetries: process.env.RAG_EMBEDDING_MAX_RETRIES
    ? parseInt(process.env.RAG_EMBEDDING_MAX_RETRIES, 10)
    : 5,

  // Optional lexical blend. finalScore = (1-w)*cosine + w*lexical.
  // Small by design: it helps exact acronyms ("GIS") that embeddings can
  // under-weight, but cannot alone push an unrelated chunk over the threshold.
  lexicalWeight: process.env.RAG_LEXICAL_WEIGHT ? parseFloat(process.env.RAG_LEXICAL_WEIGHT) : 0.15,

  debugRetrieval: process.env.RAG_DEBUG === 'true',
};

export const geminiConfig = {
  apiKey: process.env.GEMINI_API_KEY || null,
  model: process.env.GEMINI_MODEL || 'gemini-3-flash',
  baseUrl: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
  timeoutMs: process.env.GEMINI_TIMEOUT_MS ? parseInt(process.env.GEMINI_TIMEOUT_MS, 10) : 60000,
};

export function assertEmbeddingConfigured() {
  if (ragConfig.embeddingProvider !== 'gemini') {
    throw new Error(
      `EMBEDDING_PROVIDER_UNSUPPORTED: "${ragConfig.embeddingProvider}" is not supported. ` +
        'This project uses Gemini only. Set EMBEDDING_PROVIDER=gemini.'
    );
  }
  if (!geminiConfig.apiKey) {
    throw new Error(
      'GEMINI_API_KEY_MISSING: No GEMINI_API_KEY in backend/.env. ' +
        'Get a free key at https://aistudio.google.com/apikey. ' +
        'There is no local embedding fallback - embeddings cannot be generated without it.'
    );
  }
  if (!Number.isInteger(requestedDimension) || requestedDimension < 128 || requestedDimension > 3072) {
    throw new Error(
      `EMBEDDING_DIMENSION_INVALID: EMBEDDING_DIMENSIONS=${process.env.EMBEDDING_DIMENSIONS} is out of range. ` +
        'gemini-embedding-2 supports 128-3072; Google recommends 768, 1536 or 3072.'
    );
  }
}

export function assertLLMConfigured() {
  if (!geminiConfig.apiKey) {
    throw new Error(
      'GEMINI_API_KEY_MISSING: No GEMINI_API_KEY in backend/.env. ' +
        'The AI Tutor and quiz generation require it - there is no local answer fallback. ' +
        'Get a free key at https://aistudio.google.com/apikey.'
    );
  }
}

/** Stable identity stored on every chunk. A provider, model OR dimension change marks the index stale. */
export const getEmbeddingIdentity = () =>
  `${ragConfig.embeddingProvider}:${ragConfig.embeddingModel}:${ragConfig.requestedDimension}`;
