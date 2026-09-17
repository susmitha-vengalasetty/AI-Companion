import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    spaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Space',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    learningGoal: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'ARCHIVED', 'COMPLETED'],
      default: 'ACTIVE',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to speed up user + project queries and ownership checks
projectSchema.index({ userId: 1, spaceId: 1 });

const Project = mongoose.model('Project', projectSchema);
export default Project;
