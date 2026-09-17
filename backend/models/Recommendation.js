import mongoose from 'mongoose';

const recommendationSchema = new mongoose.Schema(
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
    type: {
      type: String,
      enum: ['REVIEW_PAGE', 'RETAKE_QUIZ', 'PRACTICE_WEAK_CONCEPT', 'GENERAL_STUDY'],
      default: 'GENERAL_STUDY',
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    targetConcept: {
      type: String,
      default: '',
    },
    sourceFileName: {
      type: String,
      default: '',
    },
    targetPage: {
      type: Number,
      default: 1,
    },
    priority: {
      type: String,
      enum: ['HIGH', 'MEDIUM', 'LOW'],
      default: 'MEDIUM',
    },
    isDismissed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

recommendationSchema.index({ userId: 1, projectId: 1 });

const Recommendation = mongoose.model('Recommendation', recommendationSchema);
export default Recommendation;
