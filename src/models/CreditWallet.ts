import mongoose, { Schema, Types } from 'mongoose';

export interface CreditWalletDocument {
  user: Types.ObjectId;
  balance: number;
  createdAt: Date;
  updatedAt: Date;
}

const CreditWalletSchema = new Schema<CreditWalletDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    balance: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
);

CreditWalletSchema.index({ user: 1 }, { unique: true });

const CreditWalletModel =
  (mongoose.models['CreditWallet'] as mongoose.Model<CreditWalletDocument> | undefined) ??
  mongoose.model<CreditWalletDocument>('CreditWallet', CreditWalletSchema);

export default CreditWalletModel;
