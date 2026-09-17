import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    citations: [
      {
        fileName: String,
        pageNumber: Number,
        chunkIndex: Number,
        score: Number,
        citationText: String,
      },
    ],
    sources: [
      {
        documentName: String,
        page: Number,
        citationText: String,
      },
    ],
    retrievedChunks: [
      {
        documentName: String,
        page: Number,
        chunkId: String,
        similarity: Number,
        text: String,
      },
    ],
    isSmallTalk: {
      type: Boolean,
      default: false,
    },
    hasEvidence: {
      type: Boolean,
      default: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const conversationSchema = new mongoose.Schema(
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
    title: {
      type: String,
      default: 'New Tutor Session',
      trim: true,
    },
    lastMessageSnippet: {
      type: String,
      default: '',
    },
    messages: [messageSchema],
  },
  {
    timestamps: true,
  }
);

conversationSchema.index({ userId: 1, projectId: 1, updatedAt: -1 });

const Conversation = mongoose.model('Conversation', conversationSchema);
export default Conversation;
