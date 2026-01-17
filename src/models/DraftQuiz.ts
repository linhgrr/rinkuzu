// /src/models/DraftQuiz.ts
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IChunkDetail {
  index: number;
  startPage: number;
  endPage: number;
  status: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
  lockedAt?: Date;      // When processing started
  lockedBy?: string;    // Unique request ID
}

export interface IDraftQuestion {
  question: string;
  options: string[];
  correctIndex?: number;
  correctIndexes?: number[];
  type: 'single' | 'multiple';
  explanation?: string;
}

export interface IDraftQuiz extends Document {
  userId: Types.ObjectId;
  title: string;
  categoryId?: Types.ObjectId;
  pdfData: {
    fileName: string;
    fileSize: number;
    totalPages: number;
    pdfKey: string; // S3 key for fetching
    pdfUrl?: string; // Signed URL, refreshed on access
  };
  chunks: {
    total: number;
    processed: number;
    current: number;
    chunkDetails: IChunkDetail[];
  };
  questions: IDraftQuestion[];
  status: 'uploading' | 'processing' | 'completed' | 'error' | 'expired';
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

const ChunkDetailSchema = new Schema<IChunkDetail>({
  index: { type: Number, required: true },
  startPage: { type: Number, required: true },
  endPage: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'processing', 'done', 'error'],
    default: 'pending'
  },
  error: { type: String },
  lockedAt: { type: Date },
  lockedBy: { type: String },
}, { _id: false });

const DraftQuestionSchema = new Schema<IDraftQuestion>({
  question: { type: String, required: true, trim: true },
  options: { type: [String], required: true },
  correctIndex: { type: Number },
  correctIndexes: { type: [Number] },
  type: { type: String, enum: ['single', 'multiple'], required: true },
  explanation: { type: String },
}, { _id: false });

const DraftQuizSchema = new Schema<IDraftQuiz>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
  pdfData: {
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    totalPages: { type: Number, required: true },
    pdfKey: { type: String, required: true },
    pdfUrl: { type: String },
  },
  chunks: {
    total: { type: Number, required: true },
    processed: { type: Number, default: 0 },
    current: { type: Number, default: 0 },
    chunkDetails: { type: [ChunkDetailSchema], required: true },
  },
  questions: { type: [DraftQuestionSchema], default: [] },
  status: {
    type: String,
    enum: ['uploading', 'processing', 'completed', 'error', 'expired'],
    default: 'uploading',
  },
  expiresAt: { type: Date, required: true },
}, {
  timestamps: true,
});

// TTL index for auto-cleanup after 48 hours
DraftQuizSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for user queries
DraftQuizSchema.index({ userId: 1, status: 1, createdAt: -1 });

const DraftQuiz = mongoose.models.DraftQuiz || mongoose.model<IDraftQuiz>('DraftQuiz', DraftQuizSchema);

export default DraftQuiz;
