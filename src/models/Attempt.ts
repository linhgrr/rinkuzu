import mongoose, { Schema, Types } from 'mongoose';
import type { SelectedAnswerPersistenceRecord } from '@/repositories/types/AnswerPersistence';
import { SelectedAnswerSchema } from '@/models/schemas/SelectedAnswerSchema';
import { QuizQuestionSchema, type QuizQuestionDocument } from '@/models/schemas/QuizQuestionSchema';

interface AttemptQuizSnapshotDocument {
  integrity: 'complete';
  title: string;
  slug: string;
  description?: string;
  questions: QuizQuestionDocument[];
}

interface AttemptDocument {
  user?: Types.ObjectId;
  guestEmail?: string;
  quiz: Types.ObjectId;
  quizSnapshot: AttemptQuizSnapshotDocument;
  score: number;
  totalQuestions: number;
  answers: SelectedAnswerPersistenceRecord[];
  takenAt: Date;
}

const AttemptQuizSnapshotSchema = new Schema<AttemptQuizSnapshotDocument>(
  {
    integrity: {
      type: String,
      enum: ['complete'],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    questions: {
      type: [QuizQuestionSchema],
      required: true,
      validate: {
        validator: (questions: QuizQuestionDocument[]) => questions.length > 0,
        message: 'Quiz snapshots require at least one question',
      },
    },
  },
  { _id: false },
);

const AttemptSchema = new Schema<AttemptDocument>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  guestEmail: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Guest email is invalid'],
  },
  quiz: {
    type: Schema.Types.ObjectId,
    ref: 'Quiz',
    required: [true, 'Quiz is required'],
  },
  quizSnapshot: {
    type: AttemptQuizSnapshotSchema,
    required: [true, 'Quiz snapshot is required'],
    immutable: true,
  },
  score: {
    type: Number,
    required: [true, 'Score is required'],
    min: [0, 'Score cannot be negative'],
    max: [100, 'Score cannot exceed 100'],
  },
  totalQuestions: {
    type: Number,
    required: [true, 'Total questions is required'],
    min: [1, 'Total questions must be positive'],
  },
  answers: {
    type: [SelectedAnswerSchema],
    required: [true, 'Answers are required'],
  },
  takenAt: {
    type: Date,
    default: Date.now,
  },
});

AttemptSchema.pre('validate', function validateIdentity() {
  if (Boolean(this.user) === Boolean(this.guestEmail)) {
    this.invalidate('user', 'Exactly one attempt identity is required');
  }
});

AttemptSchema.index({ user: 1, takenAt: -1 });
AttemptSchema.index({ guestEmail: 1, takenAt: -1 });
AttemptSchema.index({ quiz: 1, takenAt: -1 });
AttemptSchema.index({ user: 1, quiz: 1 });
AttemptSchema.index({ takenAt: -1 });

const Attempt =
  (mongoose.models['Attempt'] as mongoose.Model<AttemptDocument> | undefined) ??
  mongoose.model<AttemptDocument>('Attempt', AttemptSchema);

export default Attempt;
