import mongoose, { type HydratedDocument, type Model, Schema } from 'mongoose';
import { DurationUtils } from '@/types/subscription';
import { VND_MINIMUM_PAYABLE } from '@/services/billing/billing-domain';

interface IPlan {
  _id: string;
  name: string;
  price: number;
  duration: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Virtual fields
  readonly durationInfo: {
    iso8601: string;
    displayName: string;
    months: number;
  };
}

type PlanDocument = HydratedDocument<IPlan>;

const PlanSchema = new Schema<IPlan>(
  {
    _id: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      // A plan cheaper than the provider minimum, or priced in fractional dong,
      // quotes fine and then fails inside the order-create transaction. Fail at
      // the write instead, so a bad plan can never reach checkout.
      min: VND_MINIMUM_PAYABLE,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Plan price must be a whole number of dong',
      },
    },
    duration: {
      type: String,
      required: true,
      validate: {
        validator: (value: string) => DurationUtils.isValidISO8601Duration(value),
        message: 'Invalid duration format. Supported durations are P1M and P6M.',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

PlanSchema.virtual('durationInfo').get(function (this: PlanDocument) {
  return DurationUtils.getDurationInfo(this.duration);
});

// Ensure virtuals are included in JSON
PlanSchema.set('toJSON', { virtuals: true });
PlanSchema.set('toObject', { virtuals: true });

const Plan =
  (mongoose.models['Plan'] as Model<IPlan> | undefined) ||
  mongoose.model<IPlan>('Plan', PlanSchema);

export default Plan;
