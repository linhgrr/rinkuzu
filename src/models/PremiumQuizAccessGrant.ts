import mongoose, { Schema, Types } from 'mongoose';

interface PremiumQuizAccessGrantDocument {
  user: Types.ObjectId;
  quiz: Types.ObjectId;
  ledgerEntry: Types.ObjectId;
  createdAt: Date;
}

const PremiumQuizAccessGrantSchema = new Schema<PremiumQuizAccessGrantDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    quiz: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true, immutable: true },
    ledgerEntry: {
      type: Schema.Types.ObjectId,
      ref: 'CreditLedger',
      required: true,
      immutable: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

PremiumQuizAccessGrantSchema.index({ user: 1, quiz: 1 }, { unique: true });
PremiumQuizAccessGrantSchema.index({ quiz: 1, createdAt: -1 });

const PremiumQuizAccessGrant =
  (mongoose.models['PremiumQuizAccessGrant'] as
    | mongoose.Model<PremiumQuizAccessGrantDocument>
    | undefined) ??
  mongoose.model<PremiumQuizAccessGrantDocument>(
    'PremiumQuizAccessGrant',
    PremiumQuizAccessGrantSchema,
  );

export default PremiumQuizAccessGrant;
