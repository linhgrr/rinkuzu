import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IQuestion {
  question: string;
  options: string[];
  correctIndex?: number; // For single choice
  correctIndexes?: number[]; // For multiple choice
  type: 'single' | 'multiple'; // Question type
  questionImage?: string; // URL/path to question image
  optionImages?: (string | undefined)[]; // Array of URLs/paths for option images (parallel to options array)
}

export interface IQuiz extends Document {
  title: string;
  description?: string;
  category: Types.ObjectId;
  status: 'pending' | 'published' | 'rejected';
  author: Types.ObjectId;
  slug: string;
  questions: IQuestion[];
  isPrivate: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const QuestionSchema = new Schema<IQuestion>({
  question: {
    type: String,
    required: [true, 'Question text is required'],
    trim: true,
  },
  options: {
    type: [String],
    required: [true, 'Options are required'],
    validate: {
      validator: function(options: string[]) {
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
      validator: function(this: IQuestion, value: number) {
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
      validator: function(this: IQuestion, value: number[]) {
        if (this.type === 'multiple') {
          return value && value.length > 0 && value.every(i => i >= 0 && i < this.options.length);
        }
        return true;
      },
      message: 'Multiple choice questions must have at least one valid correct index within options range',
    },
  },
  questionImage: {
    type: String,
    trim: true,
  },
  optionImages: {
    type: [String],
    validate: {
      validator: function(this: IQuestion, optionImages: (string | undefined)[]) {
        // If optionImages exists, it should have same length as options
        return !optionImages || optionImages.length === 0 || optionImages.length === this.options.length;
      },
      message: 'Option images array length must match options array length',
    },
  },
});

const QuizSchema = new Schema<IQuiz>({
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
  category: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required'],
  },
  status: {
    type: String,
    enum: ['pending', 'published', 'rejected'],
    default: 'pending',
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
      validator: function(questions: IQuestion[]) {
        return questions.length > 0;
      },
      message: 'At least one question is required',
    },
  },
  isPrivate: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Indexes for better performance
QuizSchema.index({ status: 1, createdAt: -1 });
QuizSchema.index({ author: 1, createdAt: -1 });
// slug index is already created via unique: true in schema

// Prevent re-compilation in development
const Quiz = mongoose.models.Quiz || mongoose.model<IQuiz>('Quiz', QuizSchema);

export default Quiz; 