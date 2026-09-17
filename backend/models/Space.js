import mongoose from 'mongoose';

const spaceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Space name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    visualCustomization: {
      color: { type: String, default: '#3B82F6' },
      icon: { type: String, default: 'folder' },
    },
  },
  {
    timestamps: true,
  }
);

const Space = mongoose.model('Space', spaceSchema);
export default Space;
