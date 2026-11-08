import mongoose, { Schema, type Types } from 'mongoose';

const STARTER_QUIZ_LOCALES = ['vi', 'en'] as const;
type StarterQuizLocale = (typeof STARTER_QUIZ_LOCALES)[number];

/**
 * An admin-curated starter quiz (RIN-1177): shown to new learners on
 * /dashboard, as the result-page next quiz and behind the activation email.
 * Keyed on the quiz `_id`, never the slug, because slugs change.
 */
interface StarterQuizDocument {
  quiz: Types.ObjectId;
  locale: StarterQuizLocale;
  order: number;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const StarterQuizSchema = new Schema<StarterQuizDocument>(
  {
    quiz: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true },
    locale: { type: String, enum: STARTER_QUIZ_LOCALES, required: true },
    order: { type: Number, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

StarterQuizSchema.index({ quiz: 1 }, { unique: true });
StarterQuizSchema.index({ order: 1 });

const StarterQuiz =
  (mongoose.models['StarterQuiz'] as mongoose.Model<StarterQuizDocument> | undefined) ??
  mongoose.model<StarterQuizDocument>('StarterQuiz', StarterQuizSchema);

export default StarterQuiz;
