import mongoose, { Schema, Document } from 'mongoose';

interface IDailyActivity {
  questionsReviewed: number;
  xpEarned: number;
  correctCount: number;
  totalCount: number;
}

interface IUserProgress extends Document {
  userId: string;

  // Streaks
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: Date;
  streakFreezeCount: number;

  // XP
  totalXp: number;

  // Stats
  totalQuestionsLearned: number;
  totalQuizzesTaken: number;
  totalReviewSessions: number;
  lastSessionDate: Date;
  averageAccuracy: number;

  // Weekly activity
  weeklyActivity: Map<string, IDailyActivity>;
}

const DailyActivitySchema = new Schema(
  {
    questionsReviewed: { type: Number, default: 0 },
    xpEarned: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    totalCount: { type: Number, default: 0 },
  },
  { _id: false },
);

const UserProgressSchema = new Schema<IUserProgress>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Streaks
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastActiveDate: { type: Date, default: Date.now },
    streakFreezeCount: { type: Number, default: 0 },

    // XP
    totalXp: { type: Number, default: 0 },

    // Stats
    totalQuestionsLearned: { type: Number, default: 0 },
    totalQuizzesTaken: { type: Number, default: 0 },
    totalReviewSessions: { type: Number, default: 0 },
    lastSessionDate: { type: Date, default: null },
    averageAccuracy: { type: Number, default: 0 },

    // Weekly activity
    weeklyActivity: {
      type: Map,
      of: DailyActivitySchema,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.models['UserProgress'] ||
  mongoose.model<IUserProgress>('UserProgress', UserProgressSchema);
