import mongoose from 'mongoose';

const masterySchema = new mongoose.Schema(
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
    conceptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Concept',
      required: true,
      index: true,
    },
    conceptName: {
      type: String,
      required: true,
    },
    score: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    status: {
      type: String,
      enum: ['NOT_STARTED', 'LEARNING', 'MASTERED', 'WEAK'],
      default: 'NOT_STARTED',
    },
    totalAttempts: {
      type: Number,
      default: 0,
    },
    correctAnswers: {
      type: Number,
      default: 0,
    },
    lastAssessedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

masterySchema.index({ userId: 1, projectId: 1, conceptId: 1 }, { unique: true });

const Mastery = mongoose.model('Mastery', masterySchema);
export default Mastery;
