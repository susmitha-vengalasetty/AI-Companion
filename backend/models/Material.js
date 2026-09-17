import mongoose from 'mongoose';

const materialSchema = new mongoose.Schema(
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
    fileName: {
      type: String,
      required: [true, 'Original file name is required'],
      trim: true,
    },
    storagePath: {
      type: String,
      required: [true, 'Storage path is required'],
    },
    fileType: {
      type: String,
      default: 'application/pdf',
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['QUEUED', 'PROCESSING', 'READY', 'FAILED'],
      default: 'QUEUED',
      index: true,
    },
    failureReason: {
      type: String,
      default: '',
    },
    pageCount: {
      type: Number,
      default: 0,
    },
    chunkCount: {
      type: Number,
      default: 0,
    },
    processingMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast queries scoped by user & project
materialSchema.index({ userId: 1, projectId: 1 });

const Material = mongoose.model('Material', materialSchema);
export default Material;
