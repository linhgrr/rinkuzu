import mongoose, { type HydratedDocument, type Model, Schema } from 'mongoose';
import { DurationUtils } from '@/types/subscription';

interface IPlan {
  _id: string;
  name: string;
  price: number;
  duration: string;
  features: string[];
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
    },
    duration: {
      type: String,
      required: true,
      validate: {
        validator: (value: string) => DurationUtils.isValidISO8601Duration(value),
        message: 'Invalid duration format. Only the monthly P1M plan is supported.',
      },
    },
    features: {
      type: [String],
      default: [],
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
