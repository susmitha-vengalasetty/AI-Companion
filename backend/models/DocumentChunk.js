import mongoose from 'mongoose';

const documentChunkSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    materialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Material',
      required: true,
      index: true,
    },
    text: {
      type: String,
      required: true,
    },
    pageNumber: {
      type: Number,
      required: true,
      index: true,
    },
    chunkIndex: {
      type: Number,
      required: true,
    },
    heading: {
      type: String,
      default: '',
    },
    embedding: {
      type: [Number],
      default: [],
    },
    // Recorded so retrieval can detect a corpus indexed with a different model.
    // Comparing vectors across models is meaningless even when the dimension
    // happens to match, so this is the guard that makes staleness visible
    // instead of silently returning nonsense scores.
    embeddingModel: {
      type: String,
      required: true,
      index: true,
    },
    embeddingDim: {
      type: Number,
      required: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast RAG retrieval scoped strictly by userId and projectId
documentChunkSchema.index({ userId: 1, projectId: 1, pageNumber: 1 });

// One chunk per (material, chunkIndex). This lets pdfProcessingService persist
// each embedding batch as an upsert (insert if new, overwrite in place if a
// stale/incomplete chunk already exists at that index) instead of only ever
// deleting-then-reinserting the whole material at the end - which is what
// made a 429 partway through lose every chunk embedded before it.
documentChunkSchema.index({ materialId: 1, chunkIndex: 1 }, { unique: true });

const DocumentChunk = mongoose.model('DocumentChunk', documentChunkSchema);
export default DocumentChunk;
