import mongoose, { Document, Schema } from 'mongoose';

export type LlmUsageWindow = 'minute' | 'day';

export interface ILlmUsage extends Document {
  userId: string;
  action: string;
  tier: 'free' | 'premium';
  window: LlmUsageWindow;
  windowStart: Date;
  count: number;
  expireAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LlmUsageSchema = new Schema<ILlmUsage>(
  {
    userId: { type: String, required: true, index: true },
    action: { type: String, required: true, index: true },
    tier: { type: String, enum: ['free', 'premium'], required: true },
    window: { type: String, enum: ['minute', 'day'], required: true },
    windowStart: { type: Date, required: true },
    count: { type: Number, default: 0, min: 0 },
    expireAt: { type: Date, required: true },
  },
  { timestamps: true },
);

LlmUsageSchema.index({ userId: 1, action: 1, window: 1, windowStart: 1 }, { unique: true });
LlmUsageSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

const LlmUsage = mongoose.models.LlmUsage || mongoose.model<ILlmUsage>('LlmUsage', LlmUsageSchema);

export default LlmUsage;
