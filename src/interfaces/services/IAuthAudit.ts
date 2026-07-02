import type { AuthAuditEvent, AuthRequestContext } from '@/entities/AuthAccount';

export interface AuthAuditRecord extends AuthRequestContext {
  event: AuthAuditEvent;
  userId?: string;
  email?: string;
  metadata?: Record<string, unknown>;
}

export interface AuthAuditIdentity {
  userId?: string;
  email?: string;
  metadata?: Record<string, unknown>;
}

export interface IAuthAudit {
  record(input: AuthAuditRecord): Promise<void>;
}
