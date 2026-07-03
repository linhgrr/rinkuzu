import mongoose, { Schema, Types } from 'mongoose';
import type { SelectedAnswerPersistenceRecord } from '@/repositories/types/AnswerPersistence';
import { SelectedAnswerSchema } from '@/models/schemas/SelectedAnswerSchema';

interface AttemptDocument {
  user?: Types.ObjectId;
  guestEmail?: string;
  quiz: Types.ObjectId;
  score: number;
  totalQuestions: number;
  answers: SelectedAnswerPersistenceRecord[];
  takenAt: Date;
}

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
  mongoose.models['Attempt'] || mongoose.model<AttemptDocument>('Attempt', AttemptSchema);

export default Attempt;
