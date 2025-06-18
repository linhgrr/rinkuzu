import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAttempt extends Document {
  user?: Types.ObjectId; // Optional for anonymous attempts
  quiz: Types.ObjectId;
  score: number;
  answers: (number | number[])[]; // Single choice: number, Multiple choice: number[]
  takenAt: Date;
}

const AttemptSchema = new Schema<IAttempt>({
  user: {
    type: Schema.Types.ObjectId,
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
  answers: {
    type: [Schema.Types.Mixed], // Can be number or array of numbers
    required: [true, 'Answers are required'],
    validate: {
      validator: function(answers: (number | number[])[]) {
        return answers.every(answer => {
          if (Array.isArray(answer)) {
            // Multiple choice answer
            return answer.length > 0 && answer.every(a => a >= 0 && a <= 3);
          } else {
            // Single choice answer
            return answer >= 0 && answer <= 3;
          }
        });
      },
      message: 'All answers must be between 0 and 3',
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