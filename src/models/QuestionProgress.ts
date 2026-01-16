import mongoose, { Schema, Document } from 'mongoose';

export interface IQuestionProgress extends Document {
    userId: string;
    lessonId?: string; // Optional: link to specific lesson/quiz source
    questionId: string; // The unique identifier of the question (if available) or hash

    // Quiz reference for context
    quizSlug: string;
    questionRef: {
        text: string;
        options: string[];
        correctIndexes: number[];
    };

    // SRS Data
    srsLevel: number;          // 0-5
    nextReviewDate: Date;
    lastReviewDate: Date;
    interval: number;          // Days until next review
    easeFactor: number;        // Multiplier for interval (default 2.5)

    // Stats
    correctStreak: number;
    totalReviews: number;
    totalCorrect: number;
    history: Array<{
        date: Date;
        rating: 'fail' | 'hard' | 'good' | 'easy';
    }>;

    isBookmarked: boolean;
    notes: string;
}

const QuestionProgressSchema = new Schema<IQuestionProgress>({
    userId: { type: String, required: true, index: true },
    lessonId: { type: String, index: true },
    questionId: { type: String, index: true },

    quizSlug: { type: String, required: true },
    questionRef: {
        text: String,
        options: [String],
        correctIndexes: [Number]
    },

    srsLevel: { type: Number, default: 0 },
    nextReviewDate: { type: Date, default: Date.now, index: true },
    lastReviewDate: { type: Date, default: null },
    interval: { type: Number, default: 0 },
    easeFactor: { type: Number, default: 2.5 },

    correctStreak: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
    totalCorrect: { type: Number, default: 0 },

    history: [{
        date: { type: Date, default: Date.now },
        rating: {
            type: String,
            enum: ['fail', 'hard', 'good', 'easy'],
            required: true
        }
    }],

    isBookmarked: { type: Boolean, default: false },
    notes: { type: String, default: '' }
}, {
    timestamps: true
});

// Compound index to ensure one progress record per question per user
QuestionProgressSchema.index({ userId: 1, quizSlug: 1, questionId: 1 }, { unique: true });

// Index for finding due items efficiently
QuestionProgressSchema.index({ userId: 1, nextReviewDate: 1 });

export default mongoose.models.QuestionProgress || mongoose.model<IQuestionProgress>('QuestionProgress', QuestionProgressSchema);
