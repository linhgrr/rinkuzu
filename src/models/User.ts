import mongoose, { Document, Schema, Types } from 'mongoose';

import { PASSWORD_MIN_LENGTH } from '@/lib/validation/auth';
import {
  ACCOUNT_DISABLE_ACTIVE,
  ACCOUNT_DISABLE_DISABLED,
} from '@/shared/constants/account-disable';
import { USER_ROLES, type UserRole } from '@/shared/constants/user-role';

interface UserDocument extends Document {
  email: string;
  password?: string;
  name?: string;
  displayName?: string;
  bio?: string;
  avatar?: string;
  role: UserRole;

  /** Canonical soft-disable: 0 = active, 1 = disabled. Never hard-delete accounts. */
  disable: typeof ACCOUNT_DISABLE_ACTIVE | typeof ACCOUNT_DISABLE_DISABLED;
  disabledAt?: Date | null;
  disabledBy?: Types.ObjectId | null;
  /** Monotonic session revocation counter; increments on each real disable/restore. */
  authVersion: number;

  // Email verification
  emailVerified?: Date | null;
  emailVerificationTokenHash?: string | null;
  emailVerificationExpires?: Date | null;

  // Password reset
  passwordResetTokenHash?: string | null;
  passwordResetExpires?: Date | null;
  passwordChangedAt?: Date | null;

  // Lockout / login telemetry
  failedLoginAttempts?: number;
  failedLoginWindowStart?: Date | null;
  lockedUntil?: Date | null;
  lastLoginAt?: Date | null;
  lastLoginIp?: string | null;

  subscription?: {
    type: string;
    startDate?: Date;
    endDate?: Date;
    isActive: boolean;
    payosOrderId?: string;
    payosTransactionId?: string;
  };
  createdAt: Date;
}

const UserSchema = new Schema<UserDocument>({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email'],
  },
  password: {
    type: String,
    minlength: [PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`],
  },
  name: { type: String, required: false },
  displayName: {
    type: String,
    maxlength: [50, 'Display name must be at most 50 characters'],
  },
  bio: {
    type: String,
    maxlength: [160, 'Bio must be at most 160 characters'],
  },
  avatar: { type: String },
  role: {
    type: String,
    enum: USER_ROLES,
    default: 'user',
  },
  disable: {
    type: Number,
    enum: [ACCOUNT_DISABLE_ACTIVE, ACCOUNT_DISABLE_DISABLED],
    required: true,
    default: ACCOUNT_DISABLE_ACTIVE,
  },
  disabledAt: { type: Date, default: null },
  disabledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  authVersion: {
    type: Number,
    required: true,
    default: 0,
    min: [0, 'authVersion must be a non-negative integer'],
    validate: {
      validator(value: number) {
        return Number.isInteger(value) && value >= 0;
      },
      message: 'authVersion must be a non-negative integer',
    },
  },
  emailVerified: { type: Date, default: null },
  emailVerificationTokenHash: { type: String, default: null },
  emailVerificationExpires: { type: Date, default: null },

  passwordResetTokenHash: { type: String, default: null },
  passwordResetExpires: { type: Date, default: null },
  passwordChangedAt: { type: Date, default: null },

  failedLoginAttempts: { type: Number, default: 0 },
  failedLoginWindowStart: { type: Date, default: null },
  lockedUntil: { type: Date, default: null },
  lastLoginAt: { type: Date, default: null },
  lastLoginIp: { type: String, default: null },

  subscription: {
    type: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },
    isActive: { type: Boolean, default: false },
    payosOrderId: { type: String },
    payosTransactionId: { type: String },
  },
  createdAt: { type: Date, default: Date.now },
});

UserSchema.index({ role: 1, createdAt: -1 });
UserSchema.index({ createdAt: -1 });
/** Admin user list filtered by disable status, sorted by newest first. */
UserSchema.index({ disable: 1, createdAt: -1 });
/** Active-admin invariant count: role + disable exact match. */
UserSchema.index({ role: 1, disable: 1 });
UserSchema.index(
  { passwordResetTokenHash: 1 },
  { partialFilterExpression: { passwordResetTokenHash: { $type: 'string' } } },
);
UserSchema.index(
  { emailVerificationTokenHash: 1 },
  { partialFilterExpression: { emailVerificationTokenHash: { $type: 'string' } } },
);
UserSchema.index({ lockedUntil: 1 }, { sparse: true });
UserSchema.index(
  { 'subscription.isActive': 1, 'subscription.endDate': 1 },
  { partialFilterExpression: { 'subscription.isActive': true } },
);
UserSchema.pre('save', function (next) {
  if (this.isModified('password') && this.password) {
    this.passwordChangedAt = new Date();
  }
  next();
});

const User =
  (mongoose.models['User'] as mongoose.Model<UserDocument> | undefined) ??
  mongoose.model<UserDocument>('User', UserSchema);

export default User;
