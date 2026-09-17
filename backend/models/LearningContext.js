import mongoose from 'mongoose';

const learningContextSchema = new mongoose.Schema(
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
    goals: {
      type: [String],
      default: [],
    },
    preferences: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    strengths: {
      type: [String],
      default: [],
    },
    weaknesses: {
      type: [String],
      default: [],
    },
    repeatedMistakes: [
      {
        concept: String,
        description: String,
        count: { type: Number, default: 1 },
        lastOccurred: { type: Date, default: Date.now },
      },
    ],
    learningObservations: {
      type: [String],
      default: [],
    },
    recentActivitySummary: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

learningContextSchema.index({ userId: 1, projectId: 1 });

const LearningContext = mongoose.model('LearningContext', learningContextSchema);
export default LearningContext;
