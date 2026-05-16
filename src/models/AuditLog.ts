import mongoose, { Document, Schema, Types } from 'mongoose';

export type AuditEvent =
  | 'login_success'
  | 'login_failed'
  | 'login_locked'
  | 'register'
  | 'logout'
  | 'password_changed'
  | 'password_reset_requested'
  | 'password_reset_completed'
  | 'email_verified'
  | 'email_verification_sent'
  | 'account_locked'
  | 'account_unlocked';

export interface IAuditLog extends Document {
  userId?: Types.ObjectId | null;
  email?: string | null;
  event: AuditEvent;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    email: { type: String, default: null },
    event: { type: String, required: true, index: true },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

// TTL: keep auth events for 180 days.
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

const AuditLog =
  mongoose.models['AuditLog'] || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

export default AuditLog;
