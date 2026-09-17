import dotenv from 'dotenv';
import {
  ragConfig,
  geminiConfig,
  assertEmbeddingConfigured,
  getEmbeddingIdentity,
} from '../config/ragConfig.js';

dotenv.config();

/**
 * Embedding service - Google Gemini only.
 *
 * HISTORY (why this file is strict)
 * ---------------------------------
 * The original implementation fell back to `generateLocalVector()` - a 384-dim
 * character/word HASH vector - whenever the provider was unconfigured or
 * failing. It was silent, so the whole corpus was indexed with vectors encoding
 * character frequency, not meaning. Cosine over those vectors measures string
 * overlap, which is why "what is monster" retrieved "What is Data?".
 *
 * There is no fallback of any kind here. No hash vectors, no random vectors, no
 * padding or truncating to force dimension compatibility, no switching provider.
 * Failure throws.
 *
 * API (verified against ai.google.dev, September 2026)
 * ---------------------------------------------------
 *   POST {base}/models/{model}:embedContent
 *   POST {base}/models/{model}:batchEmbedContents
 *   Header: x-goog-api-key
 *   Body:   { content: { parts: [{ text }] }, output_dimensionality, task_type }
 *
 * Implemented with fetch rather than the @google/genai SDK deliberately: the
 * REST contract above is stable and documented, it adds no dependency that
 * cannot be verified offline, and it matches the existing codebase style.
 * Swapping in the SDK later only touches this file.
 *
 * TASK TYPES
 * ----------
 * Document chunks are embedded as RETRIEVAL_DOCUMENT and queries as
 * RETRIEVAL_QUERY. This asymmetry is the model's intended retrieval usage and
 * improves ranking - it is NOT a model mismatch.
 */

const MAX_INPUT_CHARS = 8000;

/** Learned from the first successful response, then enforced for the rest of the run. */
let observedDimension = null;
export const getObservedDimension = () => observedDimension;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * gemini-embedding-2 uses Matryoshka Representation Learning: requesting fewer
 * than 3072 dimensions TRUNCATES the vector, which leaves it non-unit-length.
 * Google explicitly requires normalizing in that case, otherwise cosine
 * similarity is computed over inconsistent magnitudes and ranking degrades.
 */
function normalize(vector) {
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (magnitude === 0) {
    throw new Error('EMBEDDING_GENERATION_FAILED: Gemini returned a zero vector');
  }
  return vector.map((v) => v / magnitude);
}

function validateVector(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('EMBEDDING_GENERATION_FAILED: Gemini returned an empty or non-array embedding');
  }
  if (!raw.every((v) => typeof v === 'number' && Number.isFinite(v))) {
    throw new Error('EMBEDDING_GENERATION_FAILED: embedding contains non-numeric or non-finite values');
  }

  if (observedDimension === null) {
    observedDimension = raw.length;
    if (raw.length !== ragConfig.requestedDimension) {
      // Reported, not silently accepted: the identity string embeds the
      // requested dimension, so a mismatch would make stored vectors mislabelled.
      throw new Error(
        `EMBEDDING_DIMENSION_INVALID: requested ${ragConfig.requestedDimension} dimensions but ` +
          `Gemini returned ${raw.length}. Set EMBEDDING_DIMENSIONS=${raw.length} in backend/.env, ` +
          'or use a dimension the model supports (128-3072). Vectors are never padded or truncated.'
      );
    }
    console.log(`[Embedding] Dimension confirmed: ${observedDimension} (model=${ragConfig.embeddingModel})`);
  } else if (raw.length !== observedDimension) {
    throw new Error(
      `EMBEDDING_DIMENSION_INVALID: got ${raw.length} dimensions, expected ${observedDimension}. ` +
        'Refusing to store a mixed-dimension index. Re-index after fixing configuration.'
    );
  }

  return normalize(raw);
}

/** Reads an error body for backend logs. Never returned to a client, never logs the key. */
async function geminiError(response) {
  let detail = '';
  try {
    detail = (await response.text()).slice(0, 500);
  } catch {
    detail = '(response body unreadable)';
  }

  let message = `EMBEDDING_GENERATION_FAILED: Gemini returned ${response.status}`;
  if (response.status === 429) {
    message =
      'EMBEDDING_RATE_LIMITED: Gemini free-tier rate limit hit (429 RESOURCE_EXHAUSTED). ' +
      'Increase RAG_EMBEDDING_BATCH_DELAY_MS or wait for the daily quota to reset.';
  } else if (response.status === 404) {
    message =
      `GEMINI_MODEL_UNAVAILABLE: embedding model "${ragConfig.embeddingModel}" is not available to this API key. ` +
      'Set EMBEDDING_MODEL in backend/.env to a model your key supports (see `node scripts/reindex.mjs --check`).';
  } else if (response.status === 401 || response.status === 403) {
    message = 'GEMINI_API_KEY_INVALID: Gemini rejected the API key (401/403). Check GEMINI_API_KEY.';
  }

  const err = new Error(message);
  err.status = response.status;
  err.providerDetail = detail;
  return err;
}

async function callGemini(path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), geminiConfig.timeoutMs);
  try {
    const response = await fetch(`${geminiConfig.baseUrl}/models/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiConfig.apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) throw await geminiError(response);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/** One batchEmbedContents call = one request against the rate limit. */
async function embedBatchOnce(texts, taskType) {
  const model = ragConfig.embeddingModel;
  const data = await callGemini(`${model}:batchEmbedContents`, {
    requests: texts.map((text) => ({
      model: `models/${model}`,
      content: { parts: [{ text }] },
      task_type: taskType,
      output_dimensionality: ragConfig.requestedDimension,
    })),
  });

  if (!Array.isArray(data.embeddings) || data.embeddings.length !== texts.length) {
    throw new Error(
      `EMBEDDING_GENERATION_FAILED: expected ${texts.length} embeddings, received ${data.embeddings?.length ?? 0}`
    );
  }
  return data.embeddings.map((e) => validateVector(e?.values));
}

/**
 * Bounded retry with exponential backoff. Deterministic failures (bad key,
 * unavailable model, dimension mismatch) are never retried - they will not
 * succeed on attempt 2 and would only waste quota.
 *
 * A 429 backs off starting at ragConfig.embeddingRetryBaseDelayMs, doubling
 * each attempt, capped at ragConfig.embeddingRetryMaxDelayMs. All three are
 * configurable via RAG_EMBEDDING_RETRY_BASE_MS / _MAX_MS / RAG_EMBEDDING_MAX_RETRIES
 * so the free tier can be tuned without touching code.
 */
async function withRetry(fn, label) {
  const { embeddingMaxRetries: maxRetries, embeddingRetryBaseDelayMs: baseDelay, embeddingRetryMaxDelayMs: maxDelay } = ragConfig;
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error.name === 'AbortError'
        ? new Error(`EMBEDDING_GENERATION_FAILED: no response within ${geminiConfig.timeoutMs}ms`)
        : error;

      const permanent =
        lastError.message.startsWith('EMBEDDING_DIMENSION_INVALID') ||
        lastError.message.startsWith('GEMINI_MODEL_UNAVAILABLE') ||
        lastError.message.startsWith('GEMINI_API_KEY_INVALID') ||
        (lastError.status && lastError.status !== 429 && lastError.status < 500);

      if (permanent) {
        if (lastError.providerDetail) console.error(`[Embedding] ${label}: ${lastError.providerDetail}`);
        throw lastError;
      }

      if (attempt < maxRetries) {
        const delay = Math.min(baseDelay * 2 ** (attempt - 1), maxDelay);
        console.warn(`[Embedding] ${label} attempt ${attempt}/${maxRetries}: ${lastError.message}. Retry in ${delay}ms.`);
        await sleep(delay);
      }
    }
  }
  throw lastError;
}

/** Embeds a user query (RETRIEVAL_QUERY). Same model and dimension as ingestion. */
export const generateEmbedding = async (text) => {
  assertEmbeddingConfigured();
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('EMBEDDING_GENERATION_FAILED: cannot embed empty text');
  }
  const [vector] = await withRetry(
    () => embedBatchOnce([text.slice(0, MAX_INPUT_CHARS)], 'RETRIEVAL_QUERY'),
    'query'
  );
  return vector;
};

/**
 * Embeds document chunks (RETRIEVAL_DOCUMENT), batched and paced for the free tier.
 *
 * onBatch(startIndex, vectors), if provided, is awaited immediately after each
 * batch succeeds - BEFORE the next batch is requested. This is what makes
 * re-indexing resumable: the caller (pdfProcessingService) persists that
 * batch to MongoDB right away, so if a LATER batch hits a 429 that survives
 * every retry, everything embedded so far is already saved and is not
 * re-embedded (and re-billed against quota) on the next attempt.
 */
export const generateEmbeddings = async (texts, { onBatch } = {}) => {
  assertEmbeddingConfigured();
  if (!Array.isArray(texts) || texts.length === 0) return [];

  const prepared = texts.map((t) => (t || '').slice(0, MAX_INPUT_CHARS));
  const { embeddingBatchSize: size, embeddingBatchDelayMs: delay } = ragConfig;
  const results = [];

  for (let i = 0; i < prepared.length; i += size) {
    const batch = prepared.slice(i, i + size);
    const batchNo = Math.floor(i / size) + 1;
    const vectors = await withRetry(
      () => embedBatchOnce(batch, 'RETRIEVAL_DOCUMENT'),
      `batch ${batchNo}`
    );
    results.push(...vectors);
    console.log(
      `[Embedding] ${Math.min(i + size, prepared.length)}/${prepared.length} chunks ` +
        `(model=${ragConfig.embeddingModel}, dim=${vectors[0].length})`
    );

    // Persist this batch's checkpoint before moving on. If this throws, we
    // deliberately do NOT swallow it - a save failure should stop the run.
    if (onBatch) await onBatch(i, vectors);

    // Pace requests so free-tier RPM/TPM limits are respected.
    if (i + size < prepared.length && delay > 0) await sleep(delay);
  }
  return results;
};

/**
 * Live end-to-end check used by `node scripts/reindex.mjs --check`.
 * Confirms key, model availability, reachability and a real vector - before
 * any bulk work is attempted.
 */
export const verifyEmbeddingAccess = async () => {
  assertEmbeddingConfigured();
  const started = Date.now();
  const vector = await embedBatchOnce(['connectivity check'], 'RETRIEVAL_QUERY').then((v) => v[0]);
  return {
    ok: true,
    model: ragConfig.embeddingModel,
    requestedDimension: ragConfig.requestedDimension,
    returnedDimension: vector.length,
    latencyMs: Date.now() - started,
  };
};

/** Lists models this API key can actually access. */
export const listAvailableModels = async () => {
  assertEmbeddingConfigured();
  const response = await fetch(`${geminiConfig.baseUrl}/models`, {
    headers: { 'x-goog-api-key': geminiConfig.apiKey },
  });
  if (!response.ok) throw await geminiError(response);
  const data = await response.json();
  return (data.models || []).map((m) => ({
    name: (m.name || '').replace(/^models\//, ''),
    methods: m.supportedGenerationMethods || [],
  }));
};

export const getEmbeddingModel = () => ragConfig.embeddingModel;
export { getEmbeddingIdentity };
