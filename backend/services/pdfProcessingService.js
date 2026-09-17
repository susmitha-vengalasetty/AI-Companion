import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse/lib/pdf-parse.js');
import Material from '../models/Material.js';
import DocumentChunk from '../models/DocumentChunk.js';
import Job from '../models/Job.js';
import { generateEmbeddings } from './embeddingService.js';
import { ragConfig, getEmbeddingIdentity } from '../config/ragConfig.js';

/**
 * Custom page render function to inject explicit page split markers
 */
function renderPageWithMarkers(pageData) {
  return pageData.getTextContent().then((textContent) => {
    let lastY, text = '';
    for (let item of textContent.items) {
      if (lastY === item.transform[5] || !lastY) {
        text += item.str + ' ';
      } else {
        text += '\n' + item.str + ' ';
      }
      lastY = item.transform[5];
    }
    const pageNum = pageData.pageIndex + 1;
    return `\n[[[PAGE_MARKER_${pageNum}]]]\n` + text;
  });
}

/**
 * Cleans PDF text letter-spacing artifacts (e.g. "W ester n" -> "Western", "bor der ed" -> "bordered")
 */
function normalizePDFText(text) {
  if (!text) return '';
  let out = text
    .replace(/\[\[\[PAGE_MARKER_\d+\]\]\]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();

  out = collapseOverprintedText(out);
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Collapses text that a PDF repeats to simulate bold via overprinting.
 *
 * The NCERT textbooks in this project render headings by drawing the same
 * string several times at tiny offsets. pdf.js faithfully returns every copy,
 * so a heading arrives as:
 *
 *   "Spatial Information T Spatial Information T Spatial Information T ..."
 *   "What is GIS? What is GIS? What is GIS? What is GIS? What is GIS?"
 *
 * Left uncleaned this pads chunks with duplicate tokens, wastes the embedding
 * context window on repetition, and skews any term-frequency signal. We collapse
 * a phrase that repeats back-to-back 3+ times down to a single occurrence.
 * The 3+ threshold avoids damaging legitimate repetition ("very, very").
 */
function collapseOverprintedText(text) {
  let previous;
  let result = text;

  // Applied iteratively because collapsing one layer can expose another
  // (the books overprint both whole headings and individual word fragments).
  // Capped at 8 passes so a pathological input cannot spin here.
  for (let pass = 0; pass < 8; pass++) {
    previous = result;

    // "DataData" -> "Data", "echnologyechnology" -> "echnology".
    // 3+ char fragments only, so ordinary words are untouched.
    result = result.replace(/\b(\w{3,}?)\1\b/g, '$1');

    // Adjacent repeats of a whole phrase. Uses a lookahead rather than \b so
    // phrases ending in punctuation ("What is GIS?") still match. Limited to
    // phrases of 15 words or fewer to avoid collapsing genuinely repeated
    // sentences elsewhere in the text.
    result = result.replace(/(\S(?:.*?\S)?)(?:\s+\1)+(?=\s|$)/g, (match, phrase) =>
      phrase.split(/\s+/).length <= 15 ? phrase : match
    );

    result = result.replace(/\s+/g, ' ');
    if (result === previous) break;
  }

  return result.trim();
}

/**
 * Splits text into contextually sized chunks with overlap while retaining page number.
 * Always aligns chunk boundaries to complete words and sentences.
 */
function createChunksFromPageText(pageText, pageNumber, material, targetChunkSize = 700, overlap = 100) {
  const cleanText = normalizePDFText(pageText);
  if (!cleanText || cleanText.length < 10) {
    return [];
  }

  const chunks = [];
  let startIndex = 0;

  while (startIndex < cleanText.length) {
    let endIndex = startIndex + targetChunkSize;

    if (endIndex < cleanText.length) {
      // Find nearest sentence or word boundary to end chunk cleanly
      const periodIdx = cleanText.indexOf('. ', endIndex - 50);
      if (periodIdx !== -1 && periodIdx - endIndex < 80) {
        endIndex = periodIdx + 1;
      } else {
        const nextSpace = cleanText.indexOf(' ', endIndex);
        if (nextSpace !== -1 && nextSpace - endIndex < 50) {
          endIndex = nextSpace;
        }
      }
    } else {
      endIndex = cleanText.length;
    }

    let chunkText = cleanText.slice(startIndex, endIndex).trim();

    // Ensure chunk does not start mid-word (trim leading fragment if not at boundary)
    if (startIndex > 0 && cleanText[startIndex - 1] !== ' ') {
      const firstSpace = chunkText.indexOf(' ');
      if (firstSpace !== -1 && firstSpace < 20) {
        chunkText = chunkText.slice(firstSpace + 1).trim();
      }
    }

    if (chunkText.length > 15) {
      chunks.push({
        text: chunkText,
        pageNumber,
        metadata: {
          characterCount: chunkText.length,
          wordCount: chunkText.split(/\s+/).length,
          fileName: material.fileName,
        },
      });
    }

    if (endIndex >= cleanText.length) break;

    // Move start index back by overlap, but align to a space boundary
    let nextStart = Math.max(endIndex - overlap, startIndex + 1);
    const spaceIdx = cleanText.indexOf(' ', nextStart);
    if (spaceIdx !== -1 && spaceIdx < endIndex) {
      nextStart = spaceIdx + 1;
    }
    startIndex = nextStart;
  }

  return chunks;
}

/**
 * Asynchronous job handler for processing uploaded PDF material and generating vector embeddings
 */
export const processMaterialJob = async (jobId) => {
  const job = await Job.findById(jobId);
  if (!job) return;

  const { materialId, userId, projectId, filePath } = job.payload;
  job.status = 'processing';
  job.attempts += 1;
  await job.save();

  const material = await Material.findById(materialId);
  if (!material) {
    job.status = 'failed';
    job.lastError = 'Material record not found';
    await job.save();
    return;
  }

  material.status = 'PROCESSING';
  material.failureReason = '';
  await material.save();

  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Uploaded PDF file not found at path: ${filePath}`);
    }

    const dataBuffer = fs.readFileSync(filePath);

    // Parse PDF with custom page markers
    const pdfData = await pdfParse(dataBuffer, {
      pagerender: renderPageWithMarkers,
    });

    const fullExtractedText = pdfData.text || '';
    const totalPages = pdfData.numpages || 1;

    // Split text into per-page sections using page markers
    const pageSplits = fullExtractedText.split(/\[\[\[PAGE_MARKER_(\d+)\]\]\]/);

    const allChunksToSave = [];
    let globalChunkIndex = 0;

    for (let i = 1; i < pageSplits.length; i += 2) {
      const pageNumber = parseInt(pageSplits[i], 10);
      const pageText = pageSplits[i + 1] || '';

      const pageChunks = createChunksFromPageText(pageText, pageNumber, material);

      for (const item of pageChunks) {
        allChunksToSave.push({
          userId,
          projectId,
          materialId,
          text: item.text,
          pageNumber: item.pageNumber,
          chunkIndex: globalChunkIndex++,
          metadata: item.metadata,
        });
      }
    }

    // Fallback if page marker parsing produced 0 chunks
    if (allChunksToSave.length === 0 && fullExtractedText.trim().length > 0) {
      const fallbackChunks = createChunksFromPageText(fullExtractedText, 1, material);
      for (const item of fallbackChunks) {
        allChunksToSave.push({
          userId,
          projectId,
          materialId,
          text: item.text,
          pageNumber: 1,
          chunkIndex: globalChunkIndex++,
          metadata: item.metadata,
        });
      }
    }

    if (allChunksToSave.length === 0) {
      throw new Error('No readable text extracted from PDF. (Scanned image-only PDFs without OCR text layer are not supported).');
    }

    const activeIdentity = getEmbeddingIdentity();
    const requestedDim = ragConfig.requestedDimension;

    // RESUMABILITY: on a fresh upload there is nothing to reuse, but on a
    // Retry after a previous run got partway through (e.g. hit a 429), some
    // chunks at this materialId may already carry valid, current embeddings.
    // Re-embedding those would waste quota for no reason, so we look them up
    // first and only ask Gemini for what's actually missing.
    const existingByIndex = new Map(
      (await DocumentChunk.find({ materialId }).select('chunkIndex text embedding embeddingModel embeddingDim').lean())
        .map((c) => [c.chunkIndex, c])
    );

    const isAlreadyValid = (planned) => {
      const existing = existingByIndex.get(planned.chunkIndex);
      return (
        existing &&
        existing.text === planned.text &&
        existing.embeddingModel === activeIdentity &&
        existing.embeddingDim === requestedDim &&
        Array.isArray(existing.embedding) &&
        existing.embedding.length === requestedDim
      );
    };

    const pending = allChunksToSave.filter((c) => !isAlreadyValid(c));
    const alreadyDone = allChunksToSave.length - pending.length;
    if (alreadyDone > 0) {
      console.log(`[Embedding Pipeline] ${alreadyDone}/${allChunksToSave.length} chunks already have valid embeddings from a previous run - skipping those.`);
    }

    if (pending.length > 0) {
      console.log(`[Embedding Pipeline] Generating embeddings for ${pending.length} chunk(s)...`);

      // Persist each batch to MongoDB the moment it comes back from Gemini -
      // do NOT wait until every chunk is embedded. If a later batch throws
      // (e.g. a 429 that survives every retry), everything embedded up to
      // that point is already saved and will be skipped (via isAlreadyValid
      // above) on the next Retry instead of being re-requested.
      await generateEmbeddings(
        pending.map((c) => c.text),
        {
          onBatch: async (startIndex, vectors) => {
            const ops = vectors.map((vector, j) => {
              const chunk = pending[startIndex + j];
              return {
                updateOne: {
                  filter: { materialId, chunkIndex: chunk.chunkIndex },
                  update: {
                    $set: {
                      userId,
                      projectId,
                      materialId,
                      text: chunk.text,
                      pageNumber: chunk.pageNumber,
                      chunkIndex: chunk.chunkIndex,
                      metadata: chunk.metadata,
                      embedding: vector,
                      embeddingModel: activeIdentity,
                      embeddingDim: vector.length,
                    },
                  },
                  upsert: true,
                  setDefaultsOnInsert: true,
                },
              };
            });
            await DocumentChunk.bulkWrite(ops, { ordered: true });
          },
        }
      );
    } else {
      console.log('[Embedding Pipeline] All chunks already embedded and valid - nothing to send to Gemini.');
    }

    // Final check: only mark READY if EVERY planned chunk now has a valid,
    // current embedding in the database. A READY material is a promise that
    // retrieval works - it must never be granted on partial data.
    const validCount = await DocumentChunk.countDocuments({
      materialId,
      embeddingModel: activeIdentity,
      embeddingDim: requestedDim,
    });

    if (validCount !== allChunksToSave.length) {
      throw new Error(
        `INCOMPLETE_AFTER_EMBEDDING: ${validCount}/${allChunksToSave.length} chunks have a valid embedding. ` +
        'This should not happen if generateEmbeddings completed without throwing - treating as a failure rather than risking a false READY.'
      );
    }

    // Remove any leftover chunks from a previous run whose chunkIndex no
    // longer corresponds to the current chunking output (e.g. the PDF was
    // re-processed and produced a different chunk count). Safe to do only
    // now, once every chunk we actually need is confirmed persisted.
    const validChunkIndexes = allChunksToSave.map((c) => c.chunkIndex);
    await DocumentChunk.deleteMany({ materialId, chunkIndex: { $nin: validChunkIndexes } });

    // Update Material record to READY
    material.status = 'READY';
    material.pageCount = totalPages;
    material.chunkCount = allChunksToSave.length;
    material.failureReason = '';
    material.processingMetadata = {
      extractedAt: new Date(),
      totalCharacters: fullExtractedText.length,
      embeddingsGenerated: allChunksToSave.length,
      embeddingDimensions: requestedDim,
      info: pdfData.info || {},
    };
    await material.save();

    // Mark Job completed
    job.status = 'completed';
    await job.save();
    console.log(`[PDF Processor] Successfully processed ${material.fileName} (${totalPages} pages, ${allChunksToSave.length} chunks with vector embeddings)`);
  } catch (error) {
    console.error(`[PDF Processor Error] ${material.fileName}: ${error.message}`);

    // A 429 that survived every retry is a PAUSE, not a failure: whatever was
    // embedded before it happened is already saved (see onBatch above), and
    // hitting Retry later will pick up exactly where this left off without
    // re-spending quota. Marking this FAILED would be misleading (nothing is
    // actually broken) and deleting chunks here would throw away good work -
    // so neither happens. Anything else (bad key, dimension mismatch, no
    // extractable text, etc.) is a real failure and is reported as one.
    const isQuotaPause = error.status === 429;

    material.status = isQuotaPause ? 'PROCESSING' : 'FAILED';
    material.failureReason = isQuotaPause
      ? `Paused: ${error.message} Progress so far is saved - click Retry once the limit clears (see backend logs for how many chunks are already done).`
      : error.message;
    await material.save();

    job.status = 'failed';
    job.lastError = error.message;
    await job.save();
  }
};
