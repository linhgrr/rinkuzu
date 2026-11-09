import mongoose, { Document, Schema, Types } from 'mongoose';
import { QuizQuestionSchema, type QuizQuestionDocument } from '@/models/schemas/QuizQuestionSchema';
import { MAX_QUESTIONS_PER_QUIZ } from '@/lib/validation/question';

/** Personal-data check (RIN-1338): kind names only, never matched values. */
interface QuizContentFlagsDocument {
  personalData: boolean;
  kinds: string[];
  checkedAt: Date;
  clearedBy?: Types.ObjectId;
  clearedAt?: Date;
}

interface QuizIndexHoldDocument {
  reason: 'reported';
  since: Date;
}

const QuizContentFlagsSchema = new Schema<QuizContentFlagsDocument>(
  {
    personalData: { type: Boolean, required: true },
    kinds: { type: [String], default: [] },
    checkedAt: { type: Date, required: true },
    clearedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    clearedAt: { type: Date },
  },
  { _id: false },
);

const QuizIndexHoldSchema = new Schema<QuizIndexHoldDocument>(
  {
    reason: { type: String, enum: ['reported'], required: true },
    since: { type: Date, required: true },
  },
  { _id: false },
);

interface QuizDocument extends Document {
  title: string;
  description?: string;
  author: Types.ObjectId;
  slug: string;
  slugAliases?: string[];
  questions: QuizQuestionDocument[];
  visibility: 'public' | 'personal';
  pdfUrl?: string; // S3 URL for source PDF
  sourceDraftId?: string;
  contentFlags?: QuizContentFlagsDocument;
  indexHold?: QuizIndexHoldDocument;
  createdAt: Date;
  updatedAt: Date;
}

const QuizSchema = new Schema<QuizDocument>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author is required'],
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      lowercase: true,
    },
    // Former slugs that 301 to `slug` (RIN-624). No default: the sparse index
    // must skip quizzes that never changed slug.
    slugAliases: {
      type: [String],
      default: undefined,
    },
    questions: {
      type: [QuizQuestionSchema],
      required: [true, 'Questions are required'],
      validate: {
        validator: function (questions: QuizQuestionDocument[]) {
          return questions.length >= 1 && questions.length <= MAX_QUESTIONS_PER_QUIZ;
        },
        message: `Quiz must contain between 1 and ${MAX_QUESTIONS_PER_QUIZ} questions`,
      },
    },
    visibility: {
      type: String,
      enum: ['public', 'personal'],
      required: true,
      default: 'public',
    },
    pdfUrl: {
      type: String,
      trim: true,
    },
    sourceDraftId: {
      type: String,
      trim: true,
    },
    // RIN-1338: no defaults, so quizzes saved before the check stay without the field.
    contentFlags: {
      type: QuizContentFlagsSchema,
      default: undefined,
    },
    // Set and cleared by the report flow (RIN-1343), read by indexing (RIN-1341).
    indexHold: {
      type: QuizIndexHoldSchema,
      default: undefined,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for better performance
QuizSchema.index({ createdAt: -1 });
QuizSchema.index({ visibility: 1, createdAt: -1 });
QuizSchema.index({ author: 1, createdAt: -1 });
QuizSchema.index({ author: 1, visibility: 1, createdAt: -1 });
QuizSchema.index(
  { sourceDraftId: 1 },
  {
    unique: true,
    partialFilterExpression: { sourceDraftId: { $type: 'string' } },
  },
);
QuizSchema.index({ slugAliases: 1 }, { sparse: true });
// slug index is already created via unique: true in schema

// Prevent re-compilation in development
const Quiz =
  (mongoose.models['Quiz'] as mongoose.Model<QuizDocument> | undefined) ??
  mongoose.model<QuizDocument>('Quiz', QuizSchema);

export default Quiz;
