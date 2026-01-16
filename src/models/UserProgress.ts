import mongoose, { Schema, Document } from 'mongoose';

export interface IUserProgress extends Document {
  userId: string;
  
  // Streaks
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: Date;
  streakFreezeCount: number;

  // XP & Level
  totalXp: number;
  level: number;

  // Stats
  totalQuestionsLearned: number;
  totalQuizzesTaken: number;
  totalReviewSessions: number;
  averageAccuracy: number;

  // Weekly activity
  weeklyActivity: Map<string, {
    questionsReviewed: number;
    xpEarned: number;
    accuracy: number;
  }>;
}

const UserProgressSchema = new Schema<IUserProgress>({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Streaks
  currentStreak: { type: Number, default: 0 },
  longestStreak: { type: Number, default: 0 },
  lastActiveDate: { type: Date, default: Date.now },
  streakFreezeCount: { type: Number, default: 0 },

  // XP & Level
  totalXp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },

  // Stats
  totalQuestionsLearned: { type: Number, default: 0 },
  totalQuizzesTaken: { type: Number, default: 0 },
  totalReviewSessions: { type: Number, default: 0 },
  averageAccuracy: { type: Number, default: 0 },

  // Weekly activity
  weeklyActivity: {
    type: Map,
    of: new Schema({
      questionsReviewed: { type: Number, default: 0 },
      xpEarned: { type: Number, default: 0 },
      accuracy: { type: Number, default: 0 }
    }),
    default: {}
  }
}, {
  timestamps: true
});

export default mongoose.models.UserProgress || mongoose.model<IUserProgress>('UserProgress', UserProgressSchema);
