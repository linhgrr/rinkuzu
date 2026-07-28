import mongoose from 'mongoose';
import { REPORT_STATUSES } from '@/shared/constants/report-status';
import type { ReportFields } from '@/shared/types/report';

type ReportDocument = ReportFields;

const reportQuestionSnapshotSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    index: { type: Number, required: true, min: 0 },
    question: { type: String, required: true },
    options: { type: [String], required: true },
    type: { type: String, enum: ['single', 'multiple'], required: true },
    correctIndex: { type: Number },
    correctIndexes: { type: [Number], default: undefined },
    questionImage: { type: String },
    optionImages: { type: [String], default: undefined },
  },
  { _id: false },
);

const reportSchema = new mongoose.Schema<ReportDocument>(
  {
    quizId: {
      type: String,
      required: true,
    },
    quizTitle: {
      type: String,
      required: true,
    },
    quizSlug: {
      type: String,
      required: true,
    },
    questionId: {
      type: String,
    },
    questionSnapshot: {
      type: reportQuestionSnapshotSchema,
    },
    reporterEmail: {
      type: String,
      required: true,
    },
    reporterName: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: REPORT_STATUSES,
      default: 'pending',
    },
    resolvedAt: {
      type: Date,
    },
    resolvedBy: {
      type: String,
    },
    adminNotes: {
      type: String,
      maxlength: 1000,
    },
  },
  { timestamps: true },
);

reportSchema.pre('validate', function validateQuestionContext() {
  if (Boolean(this.questionId) !== Boolean(this.questionSnapshot)) {
    this.invalidate(
      'questionId',
      'Question-level reports require both questionId and questionSnapshot',
    );
  }
});

// Index for efficient queries
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ createdAt: -1 });
reportSchema.index({ quizId: 1 });

const Report =
  (mongoose.models['Report'] as mongoose.Model<ReportDocument> | undefined) ??
  mongoose.model<ReportDocument>('Report', reportSchema);

export default Report;
