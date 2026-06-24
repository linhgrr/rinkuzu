import mongoose, { Document, Schema, Types } from 'mongoose';

interface IQuizProgress extends Document {
  userId: Types.ObjectId | string;
  quiz: Types.ObjectId;
  questionOrder: number[]; // shuffled position -> original question index
  optionOrders: number[][]; // per shuffled question: shuffled option -> original option index
  userAnswers: (number | number[])[]; // shuffled order; -1 / [] = unanswered
  currentQuestionIndex: number;
  answeredCount: number;
  totalQuestions: number;
  updatedAt: Date;
}

const QuizProgressSchema = new Schema<IQuizProgress>({
  userId: {
    type: Schema.Types.Mixed,
    ref: 'User',
    required: [true, 'User is required'],
  },
  quiz: {
    type: Schema.Types.ObjectId,
    ref: 'Quiz',
    required: [true, 'Quiz is required'],
  },
  questionOrder: {
    type: [Number],
    required: true,
  },
  optionOrders: {
    type: [[Number]],
    required: true,
  },
  userAnswers: {
    type: [Schema.Types.Mixed],
    required: true,
  },
  currentQuestionIndex: {
    type: Number,
    default: 0,
    min: 0,
  },
  answeredCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalQuestions: {
    type: Number,
    required: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// One in-progress record per user per quiz.
QuizProgressSchema.index({ userId: 1, quiz: 1 }, { unique: true });
QuizProgressSchema.index({ userId: 1, updatedAt: -1 });

const QuizProgress =
  mongoose.models['QuizProgress'] ||
  mongoose.model<IQuizProgress>('QuizProgress', QuizProgressSchema);

export default QuizProgress;
export type { IQuizProgress };
