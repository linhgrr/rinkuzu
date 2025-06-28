import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password?: string;
  name?: string;
  role: 'admin' | 'user';
  isAnonymous?: boolean;
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
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email'],
  },
  password: {
    type: String,
    required: function(this: IUser) {
      return !this.isAnonymous;
    },
    minlength: [6, 'Password must be at least 6 characters'],
    validate: {
      validator: function(this: IUser, password: string) {
        // Skip validation for anonymous users
        if (this.isAnonymous) {
          return true;
        }
        // For non-anonymous users, password must be at least 6 characters
        return password && password.length >= 6;
      },
      message: 'Password must be at least 6 characters'
    }
  },
  name: {
    type: String,
    required: false,
  },
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user',
  },
  isAnonymous: {
    type: Boolean,
    default: false,
  },
  subscription: {
    type: {
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
    payosOrderId: {
      type: String,
    },
    payosTransactionId: {
      type: String,
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Prevent re-compilation in development
const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User; 