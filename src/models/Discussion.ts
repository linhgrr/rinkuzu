import mongoose, { Document, Schema, Types } from 'mongoose';

interface DiscussionCommentDocument {
  author: Types.ObjectId;
  authorEmail: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  isEdited: boolean;
}

interface DiscussionDocument extends Document {
  quiz: Types.ObjectId;
  questionIndex: number; // Index of the question in the quiz
  comments: DiscussionCommentDocument[];
  createdAt: Date;
  updatedAt: Date;
}

const DiscussionCommentSchema = new Schema<DiscussionCommentDocument>(
  {
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author is required'],
    },
    authorEmail: {
      type: String,
      required: [true, 'Author email is required'],
      trim: true,
    },
    content: {
      type: String,
      required: [true, 'Comment content is required'],
      trim: true,
      maxlength: [2000, 'Comment cannot exceed 2000 characters'],
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

const DiscussionSchema = new Schema<DiscussionDocument>(
  {
    quiz: {
      type: Schema.Types.ObjectId,
      ref: 'Quiz',
      required: [true, 'Quiz is required'],
    },
    questionIndex: {
      type: Number,
      required: [true, 'Question index is required'],
      min: [0, 'Question index must be non-negative'],
    },
    comments: {
      type: [DiscussionCommentSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

// One discussion thread per quiz question.
DiscussionSchema.index({ quiz: 1, questionIndex: 1 }, { unique: true });

// Prevent re-compilation in development
const Discussion =
  mongoose.models['Discussion'] ||
  mongoose.model<DiscussionDocument>('Discussion', DiscussionSchema);

export default Discussion;
