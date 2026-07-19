import mongoose from 'mongoose';
import { REPORT_STATUSES } from '@/shared/constants/report-status';
import type { ReportFields } from '@/shared/types/report';

type ReportDocument = ReportFields;

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

// Index for efficient queries
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ createdAt: -1 });
reportSchema.index({ quizId: 1 });

const Report =
  (mongoose.models['Report'] as mongoose.Model<ReportDocument> | undefined) ??
  mongoose.model<ReportDocument>('Report', reportSchema);

export default Report;
