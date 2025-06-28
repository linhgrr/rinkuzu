import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISubscription extends Document {
  user: Types.ObjectId;
  userEmail: string;
  type: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  payosOrderId: string;
  payosTransactionId?: string;
  payosPaymentUrl?: string;
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
  },
  userEmail: {
    type: String,
    required: [true, 'User email is required'],
    lowercase: true,
  },
  type: {
    type: String,
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative'],
  },
  currency: {
    type: String,
    default: 'VND',
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending',
  },
  payosOrderId: {
    type: String,
    required: [true, 'PayOS order ID is required'],
  },
  payosTransactionId: {
    type: String,
  },
  payosPaymentUrl: {
    type: String,
  },
  startDate: {
    type: Date,
  },
  endDate: {
    type: Date,
  },
  isActive: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Indexes for better performance
SubscriptionSchema.index({ user: 1, createdAt: -1 });
SubscriptionSchema.index({ status: 1, createdAt: -1 });
SubscriptionSchema.index({ payosOrderId: 1 }, { unique: true });

// Prevent re-compilation in development
const Subscription = mongoose.models.Subscription || mongoose.model<ISubscription>('Subscription', SubscriptionSchema);

export default Subscription; 