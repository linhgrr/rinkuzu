import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAttempt extends Document {
  user?: Types.ObjectId | string; // Optional for anonymous attempts, can be ObjectId or email string
  quiz: Types.ObjectId;
  score: number;
  totalQuestions: number;
  answers: (number | number[])[]; // Single choice: number, Multiple choice: number[]
  takenAt: Date;
}

const AttemptSchema = new Schema<IAttempt>({
  user: {
    type: Schema.Types.Mixed, // Can be ObjectId or String
    ref: 'User',
    required: false, // Allow anonymous attempts
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
  },
  answers: {
    type: [Schema.Types.Mixed], // Can be number or array of numbers
    required: [true, 'Answers are required'],
    validate: {
      validator: function(answers: (number | number[])[]) {
        return answers.every(answer => {
          if (Array.isArray(answer)) {
            // Multiple choice answer: allow empty array (unanswered) or any valid indexes
            return answer.length === 0 || answer.every(a => typeof a === 'number' && a >= 0);
          } else {
            // Single choice answer: allow -1 (unanswered) or any valid indexes
            return answer === -1 || (typeof answer === 'number' && answer >= 0);
          }
        });
      },
      message: 'Single choice answers must be -1 (unanswered) or >= 0, multiple choice answers must be empty array (unanswered) or array of >= 0',
    },
  },
  takenAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for better performance
AttemptSchema.index({ user: 1, takenAt: -1 });
AttemptSchema.index({ quiz: 1, takenAt: -1 });
AttemptSchema.index({ user: 1, quiz: 1 });

// Prevent re-compilation in development
const Attempt = mongoose.models.Attempt || mongoose.model<IAttempt>('Attempt', AttemptSchema);

export default Attempt; 