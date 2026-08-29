import 'server-only';

import { createHash } from 'node:crypto';
import { Types, type ClientSession } from 'mongoose';

import { publicEnv } from '@/lib/public-env';
import { AdminActionAudit, EmailOutbox } from '@/models/Communication';

export class CommunicationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'CommunicationError';
  }
}

export interface AdminActor {
  id: string;
  email: string;
}

export interface PageResult<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export const DAY = 86_400_000;

export function siteUrl(): string {
  return publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/u, '');
}

export function requiredObjectId(value: string, label = 'id'): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new CommunicationError('validation_error', `Invalid ${label}`, 400);
  }
  return new Types.ObjectId(value);
}

export function pageMeta(
  page: number,
  limit: number,
  total: number,
): PageResult<never>['pagination'] {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export function auditExpiry(): Date {
  return new Date(Date.now() + 5 * 365 * DAY);
}

export async function audit(
  actor: AdminActor,
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, string> = {},
): Promise<void> {
  await AdminActionAudit.create({
    actorId: requiredObjectId(actor.id, 'actor id'),
    actorEmail: actor.email,
    action,
    entityType,
    entityId,
    details,
    expiresAt: auditExpiry(),
  });
}

export function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export async function queueMail(
  input: {
    kind: 'support_notification' | 'feedback_invitation' | 'feedback_reply' | 'feedback_reminder';
    entityType: 'support_ticket' | 'feedback_conversation';
    entityId: Types.ObjectId;
    to: string;
    from: string;
    replyTo?: string;
    subject: string;
    html: string;
    text: string;
    inReplyTo?: string;
    references?: string[];
    dedupeKey: string;
  },
  session?: ClientSession,
): Promise<void> {
  await EmailOutbox.updateOne(
    { dedupeKey: input.dedupeKey },
    {
      $setOnInsert: {
        ...input,
        references: input.references ?? [],
        status: 'pending',
        attempts: 0,
        availableAt: new Date(),
      },
    },
    { upsert: true, ...(session ? { session } : {}) },
  );
}
