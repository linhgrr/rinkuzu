import mongoose, { Schema } from 'mongoose';

import { ACTIVE_ADMIN_FENCE_ID } from '@/shared/constants/admin-invariant';

/**
 * Singleton fence that serializes admin role/status mutations.
 * Document shape is canonical: string `_id`, nonnegative integer `revision`,
 * and `updatedAt` Date. Runtime never auto-creates this document.
 *
 * Uses string document id (not ObjectId) so the singleton key is stable.
 */
export interface AdminMutationFenceDocument {
  _id: typeof ACTIVE_ADMIN_FENCE_ID | string;
  revision: number;
  updatedAt: Date;
}

const AdminMutationFenceSchema = new Schema(
  {
    _id: {
      type: String,
      required: true,
      enum: [ACTIVE_ADMIN_FENCE_ID],
    },
    revision: {
      type: Number,
      required: true,
      min: [0, 'revision must be a non-negative integer'],
      validate: {
        validator(value: number) {
          return Number.isInteger(value) && value >= 0;
        },
        message: 'revision must be a non-negative integer',
      },
    },
    updatedAt: {
      type: Date,
      required: true,
    },
  },
  {
    versionKey: false,
    collection: 'adminmutationfences',
    // Explicit: never auto-upsert / never timestamps bootstrap.
    timestamps: false,
  },
);

const AdminMutationFence =
  (mongoose.models['AdminMutationFence'] as
    | mongoose.Model<AdminMutationFenceDocument>
    | undefined) ??
  mongoose.model<AdminMutationFenceDocument>('AdminMutationFence', AdminMutationFenceSchema);

export default AdminMutationFence;
