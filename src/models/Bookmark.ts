import mongoose, { Schema, Document } from 'mongoose';

interface BookmarkDocument extends Document {
  userId: string;
  userEmail: string;
  quiz: {
    title: string;
    slug: string;
    description?: string;
  };
  question: {
    text: string;
    options: string[];
    type: 'single' | 'multiple';
    correctIndex?: number;
    correctIndexes?: number[];
    questionImage?: string;
    optionImages?: (string | undefined)[];
  };
  questionIndex: number;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
}

const BookmarkSchema = new Schema<BookmarkDocument>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    userEmail: {
      type: String,
      required: true,
      index: true,
    },
    quiz: {
      title: {
        type: String,
        required: true,
      },
      slug: {
        type: String,
        required: true,
      },
      description: String,
    },
    question: {
      text: {
        type: String,
        required: true,
      },
      options: [
        {
          type: String,
          required: true,
        },
      ],
      type: {
        type: String,
        enum: ['single', 'multiple'],
        required: true,
      },
      correctIndex: Number,
      correctIndexes: [Number],
      questionImage: String,
      optionImages: [String],
    },
    questionIndex: {
      type: Number,
      required: true,
    },
    tags: [String],
  },
  {
    timestamps: true,
  },
);

// Compound index for user and quiz
BookmarkSchema.index({ userId: 1, 'quiz.slug': 1, questionIndex: 1 }, { unique: true });

export default mongoose.models['Bookmark'] ||
  mongoose.model<BookmarkDocument>('Bookmark', BookmarkSchema);
