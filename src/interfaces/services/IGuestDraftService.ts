import type { components } from '@/generated/adaptive-api';
import type {
  GuestDraftCompletion,
  GuestDraftEntry,
  GuestDraftSource,
} from '@/shared/constants/guest-draft';

/** The API's guest draft; the vendored contract carries `questions_ready`, `completion` and `page_count`. */
export type UpstreamGuestDraft = components['schemas']['GuestQuizDraftData'];

export type GuestDraftReservation =
  { ok: true } | { ok: false; scope: 'ip' | 'daily'; retryAfterSeconds: number };

/** Per-IP and global caps (spec AC3), checked before any upstream call. */
export interface GuestDraftLimiter {
  reserve(ip: string | null): Promise<GuestDraftReservation>;
  refundIp(ip: string | null): Promise<void>;
  refundDaily(): Promise<void>;
}

/** Upstream result: the draft, or the API's HTTP status and error code when it refused. */
export type UpstreamGuestDraftResult =
  | { ok: true; draft: UpstreamGuestDraft }
  | {
      ok: false;
      status: number;
      code: string | null;
      meta: Record<string, unknown> | null;
      /** Set when the API never answered (timeout or network error): it may still be working. */
      unreachable?: true;
    };

/** The API's guest-draft endpoints, called with the service token and no user. */
export interface GuestDraftUpstream {
  create(pdf: Blob): Promise<UpstreamGuestDraftResult>;
  /** Pasted text (RIN-1538): no OCR, same draft shape, caps and TTL as a PDF draft. */
  createFromText(text: string): Promise<UpstreamGuestDraftResult>;
  /**
   * Photos (RIN-1792): the API runs OCR before any draft exists, so a refusal such as
   * `too_little_text` creates nothing. The photos are forwarded, never kept.
   */
  createFromImages(images: readonly Blob[]): Promise<UpstreamGuestDraftResult>;
  get(apiDraftId: string): Promise<UpstreamGuestDraftResult>;
  remove(apiDraftId: string): Promise<void>;
}

export interface GuestDraftEventContext {
  draftId: string;
  locale: 'vi' | 'en';
  entry: GuestDraftEntry;
  source: GuestDraftSource;
  /** Photo drafts only (RIN-1792): how many photos; null otherwise. */
  pageCount?: number | null;
}

/**
 * Server-side guest_draft_* events: locale, entry and source only, never content (file or
 * pasted text), IP or token.
 */
export interface GuestDraftEvents {
  started(context: GuestDraftEventContext): Promise<void>;
  /**
   * The draft became playable (RIN-1619): its first batch, or the whole set when the API
   * completed with no partial step. Once per draft, always before `ready`.
   */
  firstBatchReady(context: GuestDraftEventContext, msSinceSubmit: number): Promise<void>;
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

/** The photos go to the API and nowhere else: never stored, logged or sent to analytics. */
export interface GuestImageDraftCreateInput extends GuestDraftCreateBase {
  images: readonly Blob[];
}

export interface GuestDraftView {
  status: 'processing' | 'ready' | 'failed';
  progressPercent: number;
  title: string | null;
  questionCount: number;
  /**
   * True once a ready draft has every question it will get; false while it is playable
   * with its first batch only and the client should keep polling (RIN-1619).
   */
  complete: boolean;
  /** How a complete draft ended: `first_batch_only` when the rest failed; null until then. */
  completion: GuestDraftCompletion | null;
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
  /** Photos (RIN-1792): same token check, caps, attempt record and events. */
  createFromImages(input: GuestImageDraftCreateInput): Promise<GuestDraftResult>;
  /** `ip` is the polling request's: a failed draft gives its per-IP slot back (AC8). */
  status(token: string, ip: string | null): Promise<GuestDraftResult>;
}

/** What the sign-up claim needs from the draft service (RIN-1619). */
export interface GuestDraftRefresher {
  /** One status poll by token hash, so a claim takes every question the API has now. */
  refreshHashed(tokenHash: string): Promise<void>;
  /** Deletes the API draft of an incomplete draft that is being claimed as it is. */
  releaseUpstream(apiDraftId: string): Promise<void>;
}
