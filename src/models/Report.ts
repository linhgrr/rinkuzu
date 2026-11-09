import mongoose from 'mongoose';
import { REPORT_STATUSES } from '@/shared/constants/report-status';
import { REPORT_REASONS, REPORT_SOURCES } from '@/shared/constants/report-reason';
import type { ReportPersistenceFields } from '@/repositories/types/ReportPersistence';

type ReportDocument = ReportPersistenceFields;

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

function requiredUnlessQuizPage(this: ReportDocument): boolean {
  return this.source !== 'quiz_page';
}

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
    // Required unless the report came from the anonymous quiz-page flow (RIN-1343).
    reporterEmail: {
      type: String,
      required: requiredUnlessQuizPage,
    },
    reporterName: {
      type: String,
      required: requiredUnlessQuizPage,
    },
    content: {
      type: String,
      required: requiredUnlessQuizPage,
      maxlength: 2000,
    },
    reason: {
      type: String,
      enum: REPORT_REASONS,
    },
    source: {
      type: String,
      enum: REPORT_SOURCES,
    },
    ipHash: {
      type: String,
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
  if (this.source === 'quiz_page' && (this.questionId || !this.reason)) {
    this.invalidate('reason', 'Quiz-page reports require a reason and no question');
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
