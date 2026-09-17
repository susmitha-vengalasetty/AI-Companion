# AI Study Companion

An AI-powered learning workspace. Organise study material into Learning Spaces and
Projects, upload PDFs, and get grounded answers from an AI Tutor with real page
citations, plus adaptive quizzes, mastery tracking and analytics.

**Stack:** React + Vite · Node.js + Express · MongoDB Atlas · Google Gemini (LLM + embeddings) · vector RAG

Runs on Google's **Gemini API free tier** — no credit card, no other paid provider.
See [§13 Cost safety](#13-cost-safety) for what "free tier" actually means.

---

## 1. Install Node.js

Node.js **18+** (20+ recommended — built-in `fetch` is required).
<https://nodejs.org>

```bash
node --version
```

## 2. Install dependencies

```bash
cd backend  && npm install
cd ../frontend && npm install
```

## 3. Create `.env`

```bash
cd backend
cp .env.example .env
```

`backend/.env` is gitignored and **must never be committed**.

Generate a JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 4. Create a Gemini API key

Go to **<https://aistudio.google.com/apikey>** and create a key. No credit card
required. One key covers both the LLM and embeddings.

## 5. Configure `GEMINI_API_KEY`

```
GEMINI_API_KEY=your-key-here
```

## 6. Configure `GEMINI_MODEL`

```
GEMINI_MODEL=gemini-3-flash
```

`gemini-3-flash` is Google's recommended free-tier model.

⚠️ **Do not set a Pro model.** Google moved Pro models to paid-only on
1 April 2026. Only **Flash** and **Flash-Lite** remain on the free tier. If the
configured model isn't available to your key, the backend raises
`GEMINI_MODEL_UNAVAILABLE` and tells you which models you do have — it never
silently switches to a paid model.

## 7. Configure `EMBEDDING_MODEL`

```
EMBEDDING_PROVIDER=gemini
EMBEDDING_MODEL=gemini-embedding-2
EMBEDDING_DIMENSIONS=768
```

`gemini-embedding-2` is generally available: 8,192 input tokens, output
dimensions configurable from 128 to 3,072 (Google recommends 768, 1536, 3072).

⚠️ **Do not use `text-embedding-004`** (retired 14 January 2026) or
`embedding-001` (retired 14 August 2025).

**On `EMBEDDING_DIMENSIONS=768`:** Google's quality/size sweet spot. At 3072 this
corpus would store ~2.2M floats and every query would score all of them in Node.
768 cuts storage and scoring cost 4× with minimal quality loss.

The model uses Matryoshka Representation Learning, so requesting fewer than 3072
dimensions **truncates** the vector and leaves it non-unit-length. Google requires
normalising in that case, and the embedding service does so before storage —
otherwise cosine similarity would compare inconsistent magnitudes.

Changing this value makes the existing index stale. Re-index after changing it.

## 8. Connect MongoDB Atlas

```
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<database>
```

Whitelist your IP in **Atlas → Network Access**. If the connection fails the server
prints the reason and exits. There is no in-memory or local fallback.

## 9. Run the embedding check

**Do this before anything else.** It verifies everything end to end and costs one
tiny API call, rather than discovering a problem 700 chunks into a re-index.

```bash
cd backend
npm run check          # = node scripts/reindex.mjs --check
```

It checks: MongoDB Atlas connection · models visible to your key · a real embedding
(and its actual dimension) · a real LLM call. Any failure names the exact env var
to fix.

## 10. Re-index your PDFs

**Required once.** Existing chunks were embedded with an older, non-semantic
method and cannot be reused.

```bash
npm run reindex        # = node scripts/reindex.mjs --all
```

Requests are paced for the free tier (`batchEmbedContents` counts as one request
regardless of batch size, so ~730 chunks ≈ 37 requests). Large books take a few
minutes. Original PDFs in `backend/uploads/` are never deleted, and re-running
never duplicates chunks. A material reaches `READY` only after extraction,
chunking, embedding and dimension validation all succeed.

## 11. Check status

```bash
npm run status         # = node scripts/reindex.mjs --status
```

Reports per material: chunks, chunks with embeddings, missing embeddings,
embedding dimension, embedding model, and readiness. After a successful re-index
**missing embeddings should be 0**.

## 12. Calibrate the retrieval threshold

```bash
npm run evaluate       # = node scripts/evaluate-retrieval.mjs
```

`RAG_MIN_SIMILARITY` decides whether a retrieved chunk counts as evidence. **It
cannot be guessed** — it is model-specific, and Google publishes no score
distribution for `gemini-embedding-2`. The built-in default is explicitly
uncalibrated.

This script runs queries that should be answerable from your PDFs
("What is GIS?", "What is data?", "What are primary sources of data?",
"What is remote sensing?") alongside queries that should not be
("What is monster?", "What is the capital of Mars?"), and prints the semantic
score, lexical score, final score and pass/fail for each. It then suggests a
threshold sitting in the gap between the two groups.

Put the suggested value in `backend/.env` and re-run until every verdict is
`CORRECT`:

```
RAG_MIN_SIMILARITY=0.62
```

Test one question of your own:

```bash
node scripts/evaluate-retrieval.mjs --query "What is population density?"
```

## 13. Cost safety

- The Gemini API has a **free tier via Google AI Studio with no credit card**.
- It is **rate-limited, not unlimited**. As of September 2026, free-tier Flash sits
  around 10 requests/minute and roughly 1,500 requests/day, with token-per-minute
  caps. Limits change — check
  <https://ai.google.dev/gemini-api/docs/rate-limits> and your live quota at
  <https://aistudio.google.com>.
- **Pro models are paid-only** since 1 April 2026. Keep `GEMINI_MODEL` on a Flash
  model.
- Free-tier inputs may be used to improve Google's products; paid-tier inputs are
  not.
- Enabling billing on your Google project **replaces** the free allowance rather
  than adding to it.
- This project never silently switches to a paid model or another provider. If the
  configured model isn't available, it stops with `GEMINI_MODEL_UNAVAILABLE`.

## 14. Start the backend

```bash
cd backend
npm run dev     # development (--watch)
npm start       # production
```

`http://localhost:5000` · health check `GET /api/health`

## 15. Start the frontend

```bash
cd frontend
npm run dev
```

`http://localhost:5173`, proxying `/api` to the backend (see `vite.config.js`).

---

## Architecture

```
React + Vite
    │
Node + Express
    ├── MongoDB Atlas
    └── Gemini API ── gemini-3-flash      (Tutor, quiz, grading)
                   └─ gemini-embedding-2  (chunk + query embeddings)
```

RAG pipeline:

```
PDF → page-aware extraction → cleaning → chunking
    → Gemini embeddings (RETRIEVAL_DOCUMENT) → MongoDB Atlas
                                                    │
query → Gemini embedding (RETRIEVAL_QUERY) → cosine similarity + lexical signal
      → threshold → top-K → Gemini LLM → grounded answer + verified citations
```

Scoring: `final = 0.85 × semantic + 0.15 × lexical`. The threshold is applied
**before** top-K, so results are never padded with unrelated chunks to fill a
quota. If nothing passes, retrieval returns `NO_RELEVANT_CONTEXT` and the Tutor
says so rather than answering from an arbitrary nearest chunk.

Chunks are embedded as `RETRIEVAL_DOCUMENT` and queries as `RETRIEVAL_QUERY`.
This asymmetry is the model's intended retrieval usage, not a mismatch.

---

## Error reference

| Error | Cause | Fix |
|---|---|---|
| `GEMINI_API_KEY_MISSING` | No key in `.env` | Add `GEMINI_API_KEY` |
| `GEMINI_API_KEY_INVALID` | Key rejected (401/403) | Check the key at AI Studio |
| `GEMINI_MODEL_UNAVAILABLE` | Model not available to your key | `npm run check` lists what you have |
| `EMBEDDING_GENERATION_FAILED` | Gemini embedding call failed | See backend log for detail |
| `EMBEDDING_DIMENSION_INVALID` | Returned length ≠ requested | Set `EMBEDDING_DIMENSIONS` to the reported value, re-index |
| `EMBEDDING_RATE_LIMITED` / `LLM_RATE_LIMITED` | 429 free-tier limit | Raise `RAG_EMBEDDING_BATCH_DELAY_MS`, or wait for daily reset |
| `LLM_GENERATION_FAILED` | Gemini generation failed | See backend log |
| `INDEX_STALE` | Chunks indexed with another model/dimension | `npm run reindex` |
| `NO_RELEVANT_CONTEXT` | Nothing passed the threshold | Expected for off-topic questions; if wrong, run `npm run evaluate` |
| `MONGODB_UNAVAILABLE` | Atlas unreachable | Whitelist IP; verify `MONGODB_URI` |
| Material stuck `FAILED` | Scanned PDF with no text layer, or embedding failure | Check `failureReason`; OCR is not supported |

Set `RAG_DEBUG=true` to log retrieval decisions. It never logs API keys or
connection strings.

---

## Security

- `.env` is gitignored; only `.env.example` is committed. **If a `.env` was ever
  committed to this repository, the MongoDB password, JWT secret and any API key
  in it must be rotated and the file purged from Git history**
  (`git rm --cached backend/.env`, then rewrite history with `git filter-repo`).
- Retrieval is scoped by authenticated `userId` **and** `projectId`. Ownership is
  verified server-side — IDs from the frontend are never trusted.
- Uploaded document text is passed to Gemini as untrusted **data**, never as
  instructions, and the system prompt states this explicitly (prompt-injection
  mitigation).
- LLM structured output is schema-validated before anything is persisted. Quiz
  questions citing a page or filename not in the retrieved source are rejected
  rather than stored.
- Provider error bodies are logged backend-side only, never returned to clients.
  API keys are never logged.
- There are no fake embeddings, fake fallback answers, fake citations, random
  vectors, or in-memory database fallbacks anywhere in the codebase. Every failure
  path raises a named error.
