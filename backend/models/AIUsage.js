import mongoose from 'mongoose';

const aiUsageSchema = new mongoose.Schema(
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
    feature: {
      type: String,
      enum: ['TUTOR_ASK', 'QUIZ_GENERATE', 'QUIZ_EVALUATE', 'EMBEDDING'],
      required: true,
    },
    promptTokens: {
      type: Number,
      default: 0,
    },
    completionTokens: {
      type: Number,
      default: 0,
    },
    totalTokens: {
      type: Number,
      default: 0,
    },
    queryCount: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

aiUsageSchema.index({ userId: 1, projectId: 1 });

const AIUsage = mongoose.model('AIUsage', aiUsageSchema);
export default AIUsage;
