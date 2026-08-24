import mongoose, { Schema, Types } from 'mongoose';

export interface PremiumReviewJobDocument {
  submission: Types.ObjectId;
  requestedBy: Types.ObjectId;
  snapshotHash: string;
  upstreamJobId?: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  attempts: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PremiumReviewJobSchema = new Schema<PremiumReviewJobDocument>(
  {
    submission: { type: Schema.Types.ObjectId, ref: 'PremiumQuizSubmission', required: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    snapshotHash: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
    upstreamJobId: { type: String, trim: true, maxlength: 200 },
    status: { type: String, enum: ['queued', 'running', 'completed', 'failed'], default: 'queued' },
    attempts: { type: Number, required: true, default: 1, min: 1 },
    error: { type: String, trim: true, maxlength: 4000 },
  },
  { timestamps: true },
);

PremiumReviewJobSchema.index({ submission: 1, createdAt: -1 });
PremiumReviewJobSchema.index({ status: 1, updatedAt: 1 });

const PremiumReviewJob =
  (mongoose.models['PremiumReviewJob'] as mongoose.Model<PremiumReviewJobDocument> | undefined) ??
  mongoose.model<PremiumReviewJobDocument>('PremiumReviewJob', PremiumReviewJobSchema);

export default PremiumReviewJob;
