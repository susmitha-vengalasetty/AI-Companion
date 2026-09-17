import mongoose from 'mongoose';

const conceptSchema = new mongoose.Schema(
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
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    materialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Material',
    },
    chunkIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DocumentChunk',
      },
    ],
    importance: {
      type: String,
      enum: ['HIGH', 'MEDIUM', 'LOW'],
      default: 'MEDIUM',
    },
  },
  {
    timestamps: true,
  }
);

conceptSchema.index({ userId: 1, projectId: 1, name: 1 }, { unique: true });

const Concept = mongoose.model('Concept', conceptSchema);
export default Concept;
