import mongoose, { Document, Schema, Types } from 'mongoose';

interface QuizQuestionDocumentBase {
  _id: Types.ObjectId;
  question: string;
  options: string[];
  questionImage?: string;
  optionImages?: (string | undefined)[];
}

type QuizQuestionDocument = QuizQuestionDocumentBase &
  (
    | { type: 'single'; correctIndex: number; correctIndexes?: never }
    | { type: 'multiple'; correctIndex?: never; correctIndexes: number[] }
  );

interface QuizDocument extends Document {
  title: string;
  description?: string;
  folder?: Types.ObjectId | null;
  author: Types.ObjectId;
  slug: string;
  questions: QuizQuestionDocument[];
  isPrivate: boolean;
  pdfUrl?: string; // S3 URL for source PDF
  sourceDraftId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const QuestionSchema = new Schema<QuizQuestionDocument>({
  question: {
    type: String,
    required: [true, 'Question text is required'],
    trim: true,
  },
  options: {
    type: [String],
    required: [true, 'Options are required'],
    validate: {
      validator: function (options: string[]) {
        return options.length >= 2 && options.length <= 10;
      },
      message: 'Each question must have between 2 and 10 options',
    },
  },
  type: {
    type: String,
    enum: ['single', 'multiple'],
    default: 'single',
    required: [true, 'Question type is required'],
  },
  correctIndex: {
    type: Number,
    validate: {
      validator: function (this: QuizQuestionDocument, value: number) {
        if (this.type === 'single') {
          return value !== undefined && value >= 0 && value < this.options.length;
        }
        return true;
      },
      message: 'Single choice questions must have a valid correct index within options range',
    },
  },
  correctIndexes: {
    type: [Number],
    validate: {
      validator: function (this: QuizQuestionDocument, value: number[]) {
        if (this.type === 'multiple') {
          return value && value.length > 0 && value.every((i) => i >= 0 && i < this.options.length);
        }
        return true;
      },
      message:
        'Multiple choice questions must have at least one valid correct index within options range',
    },
  },
  questionImage: {
    type: String,
    trim: true,
  },
  optionImages: {
    type: [String],
    validate: {
      validator: function (this: QuizQuestionDocument, optionImages: (string | undefined)[]) {
        // If optionImages exists, it should have same length as options
        return (
          !optionImages || optionImages.length === 0 || optionImages.length === this.options.length
        );
      },
      message: 'Option images array length must match options array length',
    },
  },
});

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
      type: [QuestionSchema],
      required: [true, 'Questions are required'],
      validate: {
        validator: function (questions: QuizQuestionDocument[]) {
          return questions.length > 0;
        },
        message: 'At least one question is required',
      },
    },
    isPrivate: {
      type: Boolean,
      default: false,
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
QuizSchema.index({ isPrivate: 1, createdAt: -1 });
QuizSchema.index({ author: 1, createdAt: -1 });
QuizSchema.index({ author: 1, isPrivate: 1, createdAt: -1 });
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
