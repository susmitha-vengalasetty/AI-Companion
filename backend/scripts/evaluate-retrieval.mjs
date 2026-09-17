/**
 * Retrieval evaluation / threshold calibration.
 *
 * WHY THIS EXISTS
 * ---------------
 * RAG_MIN_SIMILARITY cannot be guessed. It is model-specific, and Google
 * publishes no score distribution for gemini-embedding-2. The default in
 * config/ragConfig.js is explicitly UNCALIBRATED.
 *
 * This script runs queries that SHOULD be answerable from the Geography PDFs
 * alongside queries that definitely should NOT be, and prints every component
 * score. A correct threshold sits in the gap between the two groups.
 *
 * It scores chunks with exactly the same maths as retrievalService
 * (finalScore = (1-w)*cosine + w*lexical) so the numbers transfer directly.
 *
 * USAGE
 *   node scripts/evaluate-retrieval.mjs                 # all projects w/ chunks
 *   node scripts/evaluate-retrieval.mjs --project <id>
 *   node scripts/evaluate-retrieval.mjs --query "your own question"
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import DocumentChunk from '../models/DocumentChunk.js';
import Project from '../models/Project.js';
import { generateEmbedding } from '../services/embeddingService.js';
import { calculateCosineSimilarity } from '../services/retrievalService.js';
import { ragConfig, getEmbeddingIdentity } from '../config/ragConfig.js';

dotenv.config();

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1] ?? true;
};

/** Should retrieve real Geography content. */
const SHOULD_MATCH = [
  'What is GIS?',
  'What is data?',
  'What are primary sources of data?',
  'What is remote sensing?',
];

/** Should retrieve nothing - not present in the corpus at any similarity. */
const SHOULD_NOT_MATCH = [
  'What is monster?',
  'What is the capital of Mars?',
];

const STOP_WORDS = new Set([
  'what', 'is', 'are', 'was', 'were', 'the', 'a', 'an', 'in', 'on', 'at', 'of',
  'for', 'to', 'from', 'with', 'by', 'about', 'can', 'you', 'tell', 'me',
  'explain', 'define', 'how', 'why', 'where', 'which', 'who', 'does', 'do',
  'did', 'this', 'that', 'these', 'those', 'there', 'here', 'give', 'show',
]);

function lexicalScore(terms, text) {
  if (terms.length === 0) return 0;
  const lower = text.toLowerCase();
  return terms.filter((t) => lower.includes(t)).length / terms.length;
}

async function evaluateQuery(query, chunks, expectMatch) {
  const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !STOP_WORDS.has(t));
  const qv = await generateEmbedding(query);

  const scored = chunks
    .map((c) => {
      const cosine = calculateCosineSimilarity(qv, c.embedding);
      const lexical = lexicalScore(terms, c.text);
      return {
        chunkId: String(c._id),
        fileName: c.materialId?.fileName || 'Document',
        page: c.pageNumber,
        cosine,
        lexical,
        final: (1 - ragConfig.lexicalWeight) * cosine + ragConfig.lexicalWeight * lexical,
        snippet: c.text.slice(0, 70).replace(/\s+/g, ' '),
      };
    })
    .sort((a, b) => b.final - a.final);

  const top = scored.slice(0, 3);
  const passed = scored.filter((r) => r.final >= ragConfig.minSimilarity);
  const verdict = expectMatch === null
    ? 'n/a'
    : (passed.length > 0) === expectMatch ? 'CORRECT' : 'WRONG';

  console.log(`\nQUERY: "${query}"   [expect: ${expectMatch === null ? 'n/a' : expectMatch ? 'evidence' : 'NO evidence'}]`);
  console.log('  page  chunkId                   semantic  lexical  final   pass  text');
  for (const r of top) {
    console.log(
      `  ${String(r.page).padStart(4)}  ${r.chunkId.padEnd(24)}  ` +
        `${r.cosine.toFixed(4).padStart(8)}  ${r.lexical.toFixed(2).padStart(7)}  ` +
        `${r.final.toFixed(4)}  ${r.final >= ragConfig.minSimilarity ? ' YES' : '  no'}  ${r.snippet}...`
    );
  }
  console.log(`  -> ${passed.length} chunk(s) passed threshold ${ragConfig.minSimilarity}. Verdict: ${verdict}`);

  return { query, expectMatch, bestFinal: scored[0]?.final ?? 0, passedCount: passed.length, verdict };
}

async function main() {
  await connectDB();

  const projectId = flag('--project');
  let filter = {};
  if (projectId) filter = { projectId };

  const chunks = await DocumentChunk.find(filter)
    .select('text pageNumber embedding embeddingModel materialId')
    .populate('materialId', 'fileName')
    .lean();

  if (chunks.length === 0) {
    console.error('\nNo chunks found. Run: node scripts/reindex.mjs --all\n');
    await mongoose.disconnect();
    process.exit(1);
  }

  const identity = getEmbeddingIdentity();
  const stale = chunks.filter((c) => c.embeddingModel !== identity);
  if (stale.length > 0) {
    console.error(`\nINDEX_STALE: ${stale.length}/${chunks.length} chunks were indexed with a different model.`);
    console.error(`Configured: ${identity}. Run: node scripts/reindex.mjs --all\n`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`\nEvaluating against ${chunks.length} chunks`);
  console.log(`Model: ${identity}`);
  console.log(`Threshold: ${ragConfig.minSimilarity}${ragConfig.isThresholdCalibrated ? '' : '  (UNCALIBRATED)'}`);
  console.log(`Formula: final = ${(1 - ragConfig.lexicalWeight).toFixed(2)}*semantic + ${ragConfig.lexicalWeight}*lexical`);

  const custom = flag('--query');
  const results = [];

  if (typeof custom === 'string') {
    results.push(await evaluateQuery(custom, chunks, null));
  } else {
    console.log('\n=== Queries that SHOULD find evidence ===');
    for (const q of SHOULD_MATCH) results.push(await evaluateQuery(q, chunks, true));
    console.log('\n=== Queries that should find NO evidence ===');
    for (const q of SHOULD_NOT_MATCH) results.push(await evaluateQuery(q, chunks, false));
  }

  const rel = results.filter((r) => r.expectMatch === true).map((r) => r.bestFinal);
  const unrel = results.filter((r) => r.expectMatch === false).map((r) => r.bestFinal);

  if (rel.length && unrel.length) {
    const lowestRelevant = Math.min(...rel);
    const highestUnrelated = Math.max(...unrel);
    console.log('\n=== Calibration ===');
    console.log(`  Lowest score among SHOULD-match queries:   ${lowestRelevant.toFixed(4)}`);
    console.log(`  Highest score among SHOULD-NOT-match:      ${highestUnrelated.toFixed(4)}`);

    if (lowestRelevant > highestUnrelated) {
      const suggested = (lowestRelevant + highestUnrelated) / 2;
      console.log(`  Separation: ${(lowestRelevant - highestUnrelated).toFixed(4)} - the groups separate cleanly.`);
      console.log(`\n  SUGGESTED: RAG_MIN_SIMILARITY=${suggested.toFixed(2)}`);
      console.log('  Put that in backend/.env and re-run this script to confirm every verdict is CORRECT.');
    } else {
      console.log('\n  WARNING: the groups OVERLAP. No single threshold separates them.');
      console.log('  Relevant content scores no higher than unrelated content, which means retrieval');
      console.log('  quality is the problem, not the threshold. Check chunk text quality and that');
      console.log('  embeddings were generated by the configured Gemini model.');
    }

    const wrong = results.filter((r) => r.verdict === 'WRONG');
    console.log(`\n  Current threshold verdicts: ${results.length - wrong.length}/${results.length} correct`);
    for (const w of wrong) console.log(`    WRONG: "${w.query}"`);
  }

  console.log('');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(`\n[Evaluation failed] ${err.message}\n`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
