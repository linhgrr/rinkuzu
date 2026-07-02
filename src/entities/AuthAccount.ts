export type AuthAuditEvent =
  | 'register'
  | 'password_reset_requested'
  | 'password_reset_completed'
  | 'email_verified'
  | 'email_verification_sent';

export interface AuthAccountIdentity {
  id: string;
  email: string;
  role: 'admin' | 'user';
}

export interface AuthAccountSecurityState extends AuthAccountIdentity {
  passwordHash?: string;
  emailVerified?: Date;
  emailVerificationTokenHash?: string;
  emailVerificationExpires?: Date;
  passwordResetTokenHash?: string;
  passwordResetExpires?: Date;
}

export interface AuthRequestContext {
  ip: string | null;
  userAgent: string | null;
}
