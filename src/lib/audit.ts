import 'server-only';

import type { Types } from 'mongoose';

import connectDB from '@/lib/mongoose';
import AuditLog, { type AuditEvent } from '@/models/AuditLog';
import { logger } from '@/lib/logger';

type AuditInput = {
  event: AuditEvent;
  userId?: string | Types.ObjectId | null;
  email?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Best-effort audit log writer. Never throws — failures are logged and swallowed
 * so they cannot break the calling auth flow.
 */
export async function recordAuthEvent(input: AuditInput): Promise<void> {
  try {
    await connectDB();
    await AuditLog.create({
      event: input.event,
      userId: input.userId ?? null,
      email: input.email ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      metadata: input.metadata ?? null,
    });
  } catch (error) {
    logger.error({ event: input.event, error }, '[audit] failed to record');
  }
}

export function extractRequestContext(request: Request | { headers: Headers }): {
  ip: string | null;
  userAgent: string | null;
} {
  const headers = request.headers;
  const forwarded = headers.get('x-forwarded-for');
  const realIp = headers.get('x-real-ip');
  const ip = (forwarded ? forwarded.split(',')[0] : realIp || '').trim() || null;
  const userAgent = headers.get('user-agent') || null;
  return { ip, userAgent };
}
