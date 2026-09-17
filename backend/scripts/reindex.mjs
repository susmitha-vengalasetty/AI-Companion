/**
 * Re-index existing materials with real Gemini embeddings.
 *
 * WHY THIS EXISTS
 * ---------------
 * Chunks created before the embedding fix used a local hash vector (384-dim,
 * non-semantic), and chunks created during the xAI phase used a different model
 * entirely. Neither can be repaired - they must be regenerated from the source
 * PDFs, which remain on disk under backend/uploads/.
 *
 * Safe and repeatable: processMaterialJob() deletes a material's existing
 * chunks before inserting new ones, so re-running never duplicates. Original
 * PDFs and Material metadata are never deleted. A material reaches READY only
 * after extraction, chunking, embedding and dimension validation all succeed.
 *
 * USAGE
 *   node scripts/reindex.mjs --check      # verify Mongo + Gemini before any bulk work
 *   node scripts/reindex.mjs --status     # report only, changes nothing
 *   node scripts/reindex.mjs --all        # re-index every material
 *   node scripts/reindex.mjs --project <id>
 *   node scripts/reindex.mjs --material <id>
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Material from '../models/Material.js';
import DocumentChunk from '../models/DocumentChunk.js';
import Job from '../models/Job.js';
import { processMaterialJob } from '../services/pdfProcessingService.js';
import { verifyEmbeddingAccess, listAvailableModels } from '../services/embeddingService.js';
import { verifyLLMAccess } from '../services/aiService.js';
import { ragConfig, geminiConfig, getEmbeddingIdentity } from '../config/ragConfig.js';

dotenv.config();

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1] ?? true;
};

function printConfig() {
  console.log('\n--- Active configuration ---');
  console.log(`  Gemini API key:      ${geminiConfig.apiKey ? 'set' : 'MISSING - all AI features will fail'}`);
  console.log(`  LLM model:           ${geminiConfig.model}`);
  console.log(`  Embedding provider:  ${ragConfig.embeddingProvider}`);
  console.log(`  Embedding model:     ${ragConfig.embeddingModel}`);
  console.log(`  Requested dimension: ${ragConfig.requestedDimension}`);
  console.log(`  Index identity:      ${getEmbeddingIdentity()}`);
  console.log(`  Relevance threshold: ${ragConfig.minSimilarity}${ragConfig.isThresholdCalibrated ? '' : '  <- UNCALIBRATED default; run scripts/evaluate-retrieval.mjs'}`);
  console.log(`  Top K:               ${ragConfig.topK}`);
  console.log(`  Lexical weight:      ${ragConfig.lexicalWeight}`);
  console.log(`  Batch size / delay:  ${ragConfig.embeddingBatchSize} / ${ragConfig.embeddingBatchDelayMs}ms\n`);
}

/** Verifies everything BEFORE spending free-tier quota on a full re-index. */
async function check() {
  printConfig();
  let allOk = true;

  process.stdout.write('  [1/4] MongoDB Atlas connection... ');
  try {
    await connectDB();
    console.log('OK');
  } catch (err) {
    console.log(`FAILED\n        MONGODB_UNAVAILABLE: ${err.message}`);
    return false;
  }

  process.stdout.write('  [2/4] Gemini model list... ');
  try {
    const models = await listAvailableModels();
    console.log(`OK (${models.length} models visible to this key)`);

    const embedOk = models.some((m) => m.name === ragConfig.embeddingModel);
    const llmOk = models.some((m) => m.name === geminiConfig.model);

    if (!embedOk) {
      allOk = false;
      console.log(`\n        GEMINI_MODEL_UNAVAILABLE: embedding model "${ragConfig.embeddingModel}" not available to this key.`);
      const candidates = models.filter((m) => m.name.includes('embedding')).map((m) => m.name);
      console.log(`        Embedding models you DO have: ${candidates.join(', ') || '(none)'}`);
      console.log('        Set EMBEDDING_MODEL in backend/.env to one of those.\n');
    }
    if (!llmOk) {
      allOk = false;
      console.log(`\n        GEMINI_MODEL_UNAVAILABLE: LLM model "${geminiConfig.model}" not available to this key.`);
      const candidates = models
        .filter((m) => m.methods.includes('generateContent') && m.name.includes('flash'))
        .map((m) => m.name);
      console.log(`        Free-tier Flash models you DO have: ${candidates.slice(0, 8).join(', ') || '(none)'}`);
      console.log('        Set GEMINI_MODEL in backend/.env to one of those.');
      console.log('        Note: Pro models moved to paid-only on 1 April 2026 - do not select one.\n');
    }
  } catch (err) {
    allOk = false;
    console.log(`FAILED\n        ${err.message}`);
  }

  process.stdout.write('  [3/4] Real embedding generation... ');
  try {
    const r = await verifyEmbeddingAccess();
    console.log(`OK (dim=${r.returnedDimension}, ${r.latencyMs}ms)`);
    if (r.returnedDimension !== r.requestedDimension) {
      allOk = false;
      console.log(`        WARNING: requested ${r.requestedDimension} but got ${r.returnedDimension}.`);
    }
  } catch (err) {
    allOk = false;
    console.log(`FAILED\n        ${err.message}`);
  }

  process.stdout.write('  [4/4] Gemini LLM generation... ');
  try {
    const r = await verifyLLMAccess();
    console.log(`OK (${r.model}, ${r.latencyMs}ms)`);
  } catch (err) {
    allOk = false;
    console.log(`FAILED\n        ${err.message}`);
  }

  console.log(allOk ? '\n  All checks passed. Safe to run --all.\n' : '\n  Fix the failures above before running --all.\n');
  await mongoose.disconnect().catch(() => {});
  return allOk;
}

async function report() {
  printConfig();
  const materials = await Material.find({}).select('fileName status projectId pageCount chunkCount').lean();
  const activeIdentity = getEmbeddingIdentity();

  console.log(`${materials.length} material(s):\n`);
  let needing = 0;

  for (const m of materials) {
    const chunks = await DocumentChunk.find({ materialId: m._id })
      .select('embedding embeddingModel embeddingDim')
      .lean();
    const withEmb = chunks.filter((c) => c.embedding && c.embedding.length > 0).length;
    const missing = chunks.length - withEmb;
    const dims = new Set(chunks.map((c) => c.embedding?.length || 0));
    const models = new Set(chunks.map((c) => c.embeddingModel || '(none recorded)'));
    const stale = chunks.length === 0 || [...models].some((mod) => mod !== activeIdentity);
    if (stale || missing > 0) needing += 1;

    console.log(`  ${m.fileName}`);
    console.log(`    status:              ${m.status}`);
    console.log(`    pages:               ${m.pageCount ?? '?'}`);
    console.log(`    chunks:              ${chunks.length}`);
    console.log(`    chunks w/ embedding: ${withEmb}`);
    console.log(`    missing embeddings:  ${missing}`);
    console.log(`    embedding dimension: ${[...dims].join(', ') || 'none'}`);
    console.log(`    embedding model:     ${[...models].join(', ') || 'none'}`);
    console.log(`    READY FOR RAG:       ${!stale && missing === 0 && m.status === 'READY' ? 'yes' : 'NO - needs re-index'}\n`);
  }

  console.log(needing > 0
    ? `${needing} material(s) need re-indexing. Run: node scripts/reindex.mjs --all\n`
    : 'All materials are current.\n');
}

async function reindexMaterial(material) {
  console.log(`\n--- Re-indexing: ${material.fileName} ---`);
  const job = await Job.create({
    type: 'MATERIAL_PROCESSING',
    status: 'queued',
    payload: {
      materialId: material._id,
      userId: material.userId,
      projectId: material.projectId,
      filePath: material.storagePath,
    },
  });

  await processMaterialJob(job._id);

  const refreshed = await Material.findById(material._id).lean();
  const total = await DocumentChunk.countDocuments({ materialId: material._id });
  const withEmb = await DocumentChunk.countDocuments({
    materialId: material._id,
    embedding: { $exists: true, $ne: [] },
  });

  if (refreshed.status === 'READY' && total > 0 && withEmb === total) {
    console.log(`    OK - chunks=${total}, embeddings=${withEmb}, dim=${refreshed.processingMetadata?.embeddingDimensions}`);
    return { ok: true, total, withEmb };
  }

  // Exact failure reported; never silently marked READY.
  console.error(`    FAILED - status=${refreshed.status}, chunks=${total}, embeddings=${withEmb}`);
  console.error(`    reason: ${refreshed.failureReason || '(none recorded)'}`);
  return { ok: false, total, withEmb };
}

async function main() {
  if (args.includes('--check')) {
    const ok = await check();
    process.exit(ok ? 0 : 1);
  }

  await connectDB();

  if (args.includes('--status') || args.length === 0) {
    await report();
    await mongoose.disconnect();
    return;
  }

  let query = {};
  if (flag('--material')) query = { _id: flag('--material') };
  else if (flag('--project')) query = { projectId: flag('--project') };
  else if (!args.includes('--all')) {
    console.error('Specify --check, --status, --all, --project <id>, or --material <id>');
    await mongoose.disconnect();
    process.exit(1);
  }

  const materials = await Material.find(query);
  if (materials.length === 0) {
    console.log('No materials matched.');
    await mongoose.disconnect();
    return;
  }

  printConfig();
  console.log(`Re-indexing ${materials.length} material(s) as "${getEmbeddingIdentity()}"...`);
  console.log('Requests are paced for the Gemini free tier; large books take a few minutes.\n');

  let ok = 0;
  let failed = 0;
  let totalChunks = 0;
  let totalEmbeddings = 0;

  for (const m of materials) {
    // Sequential by design: 8 GB RAM, and free-tier rate limits.
    // eslint-disable-next-line no-await-in-loop
    const r = await reindexMaterial(m);
    totalChunks += r.total;
    totalEmbeddings += r.withEmb;
    r.ok ? ok++ : failed++;
  }

  console.log(`\n=== Summary ===`);
  console.log(`  materials succeeded:  ${ok}`);
  console.log(`  materials failed:     ${failed}`);
  console.log(`  chunks created:       ${totalChunks}`);
  console.log(`  embeddings stored:    ${totalEmbeddings}`);
  console.log(`  embeddings missing:   ${totalChunks - totalEmbeddings}`);
  console.log(`\nNext: node scripts/reindex.mjs --status`);
  console.log(`Then: node scripts/evaluate-retrieval.mjs   (to calibrate RAG_MIN_SIMILARITY)\n`);

  await mongoose.disconnect();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(`\n[Re-index aborted] ${err.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
