import mongoose, { Document, Schema, Types } from 'mongoose';
import { QuizQuestionSchema, type QuizQuestionDocument } from '@/models/schemas/QuizQuestionSchema';
import { MAX_QUESTIONS_PER_QUIZ } from '@/lib/validation/question';

interface QuizDocument extends Document {
  title: string;
  description?: string;
  folder?: Types.ObjectId | null;
  author: Types.ObjectId;
  slug: string;
  questions: QuizQuestionDocument[];
  visibility: 'public' | 'personal';
  pdfUrl?: string; // S3 URL for source PDF
  sourceDraftId?: string;
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
    folder: {
      type: Schema.Types.ObjectId,
      ref: 'Folder',
      default: null,
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
QuizSchema.index({ author: 1, folder: 1, createdAt: -1 });
QuizSchema.index(
  { sourceDraftId: 1 },
  {
    unique: true,
    partialFilterExpression: { sourceDraftId: { $type: 'string' } },
  },
);
// slug index is already created via unique: true in schema

// Prevent re-compilation in development
const Quiz =
  (mongoose.models['Quiz'] as mongoose.Model<QuizDocument> | undefined) ??
  mongoose.model<QuizDocument>('Quiz', QuizSchema);

export default Quiz;
