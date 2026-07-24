import mongoose, { Schema, type Model, type Types } from 'mongoose';

const AbuseSignalSchema = new Schema(
  {
    eventId: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    signalType: {
      type: String,
      enum: ['device', 'network', 'email', 'payer', 'promo_abuse'],
      required: true,
    },
    normalizedVersion: { type: Number, required: true, min: 1 },
    keyVersion: { type: String, required: true },
    hash: { type: String, required: true },
    strength: { type: String, enum: ['weak', 'strong'], required: true },
    observedAt: { type: Date, required: true },
    validUntil: { type: Date, required: true },
    source: { type: String, required: true, maxlength: 80 },
  },
  { timestamps: true },
);

AbuseSignalSchema.index({ eventId: 1 }, { unique: true });
AbuseSignalSchema.index({ signalType: 1, keyVersion: 1, hash: 1, validUntil: 1 });
AbuseSignalSchema.index({ user: 1, validUntil: 1 });

const AbuseCaseReasonSchema = new Schema(
  {
    reasonKey: { type: String, required: true },
    reasonType: { type: String, required: true },
    firstSeenAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    validUntil: { type: Date, required: true },
    weight: { type: Number, required: true, min: 0, max: 100 },
    evidenceCount: { type: Number, required: true, min: 1 },
    strong: { type: Boolean, required: true },
  },
  { _id: false, strict: true },
);

const AbuseCaseSchema = new Schema(
  {
    publicId: { type: String, required: true },
    users: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    reasons: { type: [AbuseCaseReasonSchema], required: true, default: [] },
    score: { type: Number, required: true, min: 0, max: 100, default: 0 },
    peakScore: { type: Number, required: true, min: 0, max: 100, default: 0 },
    status: {
      type: String,
      enum: ['open', 'dismissed', 'resolved'],
      required: true,
      default: 'open',
    },
    reopenedAt: { type: Date },
    dismissedAt: { type: Date },
  },
  { timestamps: true },
);

AbuseCaseSchema.index({ publicId: 1 }, { unique: true });
AbuseCaseSchema.index({ users: 1, status: 1 });
AbuseCaseSchema.index({ status: 1, score: -1, updatedAt: -1 });

const AbuseAdminAuditSchema = new Schema(
  {
    eventId: { type: String, required: true },
    admin: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    case: { type: Schema.Types.ObjectId, ref: 'AbuseCase', required: true },
    action: {
      type: String,
      enum: ['view', 'dismiss', 'reopen', 'resolve', 'export'],
      required: true,
    },
    occurredAt: { type: Date, required: true },
    note: { type: String, maxlength: 1_000 },
  },
  { timestamps: true },
);
AbuseAdminAuditSchema.index({ eventId: 1 }, { unique: true });
AbuseAdminAuditSchema.index({ case: 1, occurredAt: -1 });

function model<T>(name: string, schema: Schema): Model<T> {
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema);
}

export interface AbuseSignalRecord {
  _id: Types.ObjectId;
  eventId: string;
  user: Types.ObjectId;
  signalType: 'device' | 'network' | 'email' | 'payer' | 'promo_abuse';
  normalizedVersion: number;
  keyVersion: string;
  hash: string;
  strength: 'weak' | 'strong';
  observedAt: Date;
  validUntil: Date;
  source: string;
}

export const AbuseSignal = model<AbuseSignalRecord>('AbuseSignal', AbuseSignalSchema);
export const AbuseCase = model('AbuseCase', AbuseCaseSchema);
export const AbuseAdminAudit = model('AbuseAdminAudit', AbuseAdminAuditSchema);
