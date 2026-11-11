import type { components } from '@/generated/adaptive-api';
import type { GuestDraftEntry, GuestDraftSource } from '@/shared/constants/guest-draft';

export type UpstreamGuestDraft = components['schemas']['GuestQuizDraftData'];

export type GuestDraftReservation =
  | { ok: true }
  | { ok: false; scope: 'ip' | 'daily'; retryAfterSeconds: number };

/** Per-IP and global caps (spec AC3), checked before any upstream call. */
export interface GuestDraftLimiter {
  reserve(ip: string | null): Promise<GuestDraftReservation>;
  refundIp(ip: string | null): Promise<void>;
  refundDaily(): Promise<void>;
}

/** Upstream result: the draft, or the API's HTTP status and error code when it refused. */
export type UpstreamGuestDraftResult =
  | { ok: true; draft: UpstreamGuestDraft }
  | { ok: false; status: number; code: string | null; meta: Record<string, unknown> | null };

/** The API's guest-draft endpoints, called with the service token and no user. */
export interface GuestDraftUpstream {
  create(pdf: Blob): Promise<UpstreamGuestDraftResult>;
  /** Pasted text (RIN-1538): no OCR, same draft shape, caps and TTL as a PDF draft. */
  createFromText(text: string): Promise<UpstreamGuestDraftResult>;
  get(apiDraftId: string): Promise<UpstreamGuestDraftResult>;
  remove(apiDraftId: string): Promise<void>;
}

export interface GuestDraftEventContext {
  draftId: string;
  locale: 'vi' | 'en';
  entry: GuestDraftEntry;
  source: GuestDraftSource;
}

/**
 * Server-side guest_draft_* events: locale, entry and source only, never content (file or
 * pasted text), IP or token.
 */
export interface GuestDraftEvents {
  started(context: GuestDraftEventContext): Promise<void>;
  ready(context: GuestDraftEventContext): Promise<void>;
  failed(context: GuestDraftEventContext, reason: string): Promise<void>;
  claimed(context: GuestDraftEventContext): Promise<void>;
}

interface GuestDraftCreateBase {
  token: string;
  locale: 'vi' | 'en';
  entry: GuestDraftEntry;
  ip: string | null;
}

export interface GuestDraftCreateInput extends GuestDraftCreateBase {
  pdf: Blob;
}

/** The text is passed to the API and never stored, logged or sent to analytics here. */
export interface GuestTextDraftCreateInput extends GuestDraftCreateBase {
  text: string;
}

export interface GuestDraftView {
  status: 'processing' | 'ready' | 'failed';
  progressPercent: number;
  title: string | null;
  questionCount: number;
  failureReason: string | null;
}

export type GuestDraftResult =
  | { ok: true; draft: GuestDraftView }
  | { ok: false; error: 'limit'; scope: 'ip' | 'daily'; retryAfterSeconds: number }
  | { ok: false; error: 'token_in_use' | 'not_found' }
  | {
      ok: false;
      error: 'upstream';
      status: number;
      code: string | null;
      meta: Record<string, unknown> | null;
    };

export interface IGuestDraftService {
  create(input: GuestDraftCreateInput): Promise<GuestDraftResult>;
  /** Same token check, per-IP and global caps and attempt record as `create` (RIN-1538). */
  createFromText(input: GuestTextDraftCreateInput): Promise<GuestDraftResult>;
  /** `ip` is the polling request's: a failed draft gives its per-IP slot back (AC8). */
  status(token: string, ip: string | null): Promise<GuestDraftResult>;
}
