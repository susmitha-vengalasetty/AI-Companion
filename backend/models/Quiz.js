import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['MCQ', 'OPEN_ENDED'],
      default: 'MCQ',
    },
    conceptName: {
      type: String,
      required: true,
    },
    questionText: {
      type: String,
      required: true,
    },
    options: [String],
    correctAnswer: {
      type: String,
      required: true,
    },
    explanation: {
      type: String,
      required: true,
    },
    citationText: {
      type: String,
      default: '',
    },
    sourcePage: {
      type: Number,
      default: 1,
    },
    sourceFileName: {
      type: String,
      default: '',
    },
  },
  { _id: true }
);

const quizSchema = new mongoose.Schema(
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
      default: 'Adaptive Knowledge Check',
    },
    difficulty: {
      type: String,
      enum: ['EASY', 'MEDIUM', 'HARD', 'ADAPTIVE'],
      default: 'ADAPTIVE',
    },
    questions: [questionSchema],
    totalQuestions: {
      type: Number,
      default: 0,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

quizSchema.index({ userId: 1, projectId: 1 });

const Quiz = mongoose.model('Quiz', quizSchema);
export default Quiz;
