import mongoose, { Document, Schema } from 'mongoose';

import { PASSWORD_MIN_LENGTH } from '@/lib/validation/auth';

interface IUser extends Document {
  email: string;
  password?: string;
  name?: string;
  displayName?: string;
  bio?: string;
  avatar?: string;
  role: 'admin' | 'user';
  isAnonymous?: boolean;

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

const UserSchema = new Schema<IUser>({
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
    required: function (this: IUser) {
      return !this.isAnonymous;
    },
    minlength: [PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`],
    validate: {
      validator: function (this: IUser, password: string) {
        if (this.isAnonymous) return true;
        return Boolean(password) && password.length >= PASSWORD_MIN_LENGTH;
      },
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    },
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
    enum: ['admin', 'user'],
    default: 'user',
  },
  isAnonymous: { type: Boolean, default: false },

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
UserSchema.index(
  { passwordResetTokenHash: 1 },
  { sparse: true, partialFilterExpression: { passwordResetTokenHash: { $type: 'string' } } },
);
UserSchema.index(
  { emailVerificationTokenHash: 1 },
  { sparse: true, partialFilterExpression: { emailVerificationTokenHash: { $type: 'string' } } },
);
UserSchema.index({ lockedUntil: 1 }, { sparse: true });

UserSchema.pre('save', function (next) {
  if (this.isModified('password') && !this.isAnonymous) {
    this.passwordChangedAt = new Date();
  }
  next();
});

const User = mongoose.models['User'] || mongoose.model<IUser>('User', UserSchema);

export default User;
