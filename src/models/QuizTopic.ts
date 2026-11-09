import mongoose, { Schema, type Types } from 'mongoose';
import { QUIZ_TOPIC_LOCALES, QUIZ_TOPIC_SLUG_PATTERN } from '@/shared/constants/quiz-topic';

type QuizTopicLocale = (typeof QUIZ_TOPIC_LOCALES)[number];

/**
 * An admin-curated topic hub (RIN-1248, spec RIN-1241): a public page that
 * groups public quizzes on one subject. Quiz membership lives in
 * QuizTopicAssignment, so owner edits of a quiz can never touch it.
 */
interface QuizTopicDocument {
  slug: string;
  locale: QuizTopicLocale;
  name: string;
  intro: string;
  order: number;
  published: boolean;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const QuizTopicSchema = new Schema<QuizTopicDocument>(
  {
    slug: { type: String, required: true, match: QUIZ_TOPIC_SLUG_PATTERN },
    locale: { type: String, enum: QUIZ_TOPIC_LOCALES, required: true },
    name: { type: String, required: true, trim: true },
    intro: { type: String, default: '' },
    published: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    order: { type: Number, required: true },
  },
  { timestamps: true },
);

QuizTopicSchema.index({ slug: 1 }, { unique: true });
QuizTopicSchema.index({ order: 1 });

const QuizTopic =
  (mongoose.models['QuizTopic'] as mongoose.Model<QuizTopicDocument> | undefined) ??
  mongoose.model<QuizTopicDocument>('QuizTopic', QuizTopicSchema);

export default QuizTopic;
