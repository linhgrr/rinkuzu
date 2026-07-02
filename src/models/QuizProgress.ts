import mongoose, { Document, Schema, Types } from 'mongoose';
import { SelectedAnswerSchema } from '@/models/schemas/SelectedAnswerSchema';
import type { SelectedAnswerPersistenceRecord } from '@/repositories/types/AnswerPersistence';

interface QuizProgressDocument extends Document {
  userId: Types.ObjectId;
  quiz: Types.ObjectId;
  questionOrder: number[]; // shuffled position -> original question index
  optionOrders: number[][]; // per shuffled question: shuffled option -> original option index
  userAnswers: SelectedAnswerPersistenceRecord[];
  currentQuestionIndex: number;
  answeredCount: number;
  totalQuestions: number;
  updatedAt: Date;
}

const QuizProgressSchema = new Schema<QuizProgressDocument>({
  userId: {
    type: Schema.Types.ObjectId,
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
    type: [SelectedAnswerSchema],
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
  mongoose.model<QuizProgressDocument>('QuizProgress', QuizProgressSchema);

export default QuizProgress;
