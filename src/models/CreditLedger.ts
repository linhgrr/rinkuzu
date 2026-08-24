import mongoose, { Schema, Types } from 'mongoose';

export interface CreditLedgerDocument {
  user: Types.ObjectId;
  amount: number;
  balanceAfter: number;
  type: 'submission_reward' | 'quiz_unlock' | 'refund' | 'admin_adjustment' | 'fraud_reversal';
  referenceType: 'premium_submission' | 'premium_quiz' | 'admin';
  referenceId: string;
  idempotencyKey: string;
  note?: string;
  createdAt: Date;
}

const CreditLedgerSchema = new Schema<CreditLedgerDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    amount: { type: Number, required: true, immutable: true },
    balanceAfter: { type: Number, required: true, min: 0, immutable: true },
    type: {
      type: String,
      enum: ['submission_reward', 'quiz_unlock', 'refund', 'admin_adjustment', 'fraud_reversal'],
      required: true,
      immutable: true,
    },
    referenceType: {
      type: String,
      enum: ['premium_submission', 'premium_quiz', 'admin'],
      required: true,
      immutable: true,
    },
    referenceId: { type: String, required: true, trim: true, maxlength: 200, immutable: true },
    idempotencyKey: { type: String, required: true, trim: true, maxlength: 200, immutable: true },
    note: { type: String, trim: true, maxlength: 1000, immutable: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

CreditLedgerSchema.index({ user: 1, createdAt: -1 });
CreditLedgerSchema.index({ idempotencyKey: 1 }, { unique: true });
CreditLedgerSchema.index({ referenceType: 1, referenceId: 1, type: 1 });

const CreditLedgerModel =
  (mongoose.models['CreditLedger'] as mongoose.Model<CreditLedgerDocument> | undefined) ??
  mongoose.model<CreditLedgerDocument>('CreditLedger', CreditLedgerSchema);

export default CreditLedgerModel;
