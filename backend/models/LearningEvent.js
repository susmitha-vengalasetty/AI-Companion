import mongoose from 'mongoose';

const learningEventSchema = new mongoose.Schema(
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
    eventType: {
      type: String,
      enum: ['ASK_TUTOR', 'TAKE_QUIZ', 'UPLOAD_MATERIAL', 'VIEW_ANALYTICS', 'REVIEW_RECOMMENDATION'],
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

learningEventSchema.index({ userId: 1, projectId: 1, timestamp: -1 });

const LearningEvent = mongoose.model('LearningEvent', learningEventSchema);
export default LearningEvent;
