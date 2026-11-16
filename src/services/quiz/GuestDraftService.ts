import type {
  GuestDraftCompleteUpdate,
  GuestDraftQuestion,
  GuestDraftRecord,
  IGuestQuizDraftRepository,
} from '@/interfaces/repositories/IGuestQuizDraftRepository';
import type {
  GuestDraftCreateInput,
  GuestDraftEvents,
  GuestDraftLimiter,
  GuestDraftRefresher,
  GuestDraftResult,
  GuestDraftUpstream,
  GuestDraftView,
  IGuestDraftService,
  GuestDraftEventContext,
  GuestTextDraftCreateInput,
  UpstreamGuestDraft,
  UpstreamGuestDraftResult,
} from '@/interfaces/services/IGuestDraftService';
import { hashGuestClaimToken } from '@/lib/guest-claim-token';
import {
  GUEST_DRAFT_TTL_MS,
  type GuestDraftCompletion,
  type GuestDraftFileType,
  type GuestDraftSource,
} from '@/shared/constants/guest-draft';

type Clock = () => Date;
type UpstreamQuestion = NonNullable<UpstreamGuestDraft['questions']>[number];
type UpstreamFailure = Extract<UpstreamGuestDraftResult, { ok: false }>;
type StartInput = Omit<GuestDraftCreateInput, 'pdf'> & {
  sourceFileType?: GuestDraftFileType | undefined;
};
type UpstreamStart = () => Promise<UpstreamGuestDraftResult>;

const FAILED_UPSTREAM_STATUSES = new Set(['failed', 'cancelled', 'expired']);

const TITLE_MAX_LENGTH = 60;
/** The generic word the API sends until it names the topic (RIN-1544): not a title. */
const GENERIC_TITLE = 'quiz';
/** The server has no learner time zone: vi dates follow Vietnam, en dates UTC. */
const FALLBACK_TIME_ZONES = { vi: 'Asia/Ho_Chi_Minh', en: 'UTC' } as const;

/**
 * The quiz title a ready guest draft keeps (RIN-1546): the API's topic title, or
 * "Quiz <date>" in the learner's locale when it sent none. Never the file name.
 */
function guestDraftTitle(
  apiTitle: string | null | undefined,
  locale: GuestDraftRecord['locale'],
  createdAt: Date,
): string {
  const title = apiTitle?.trim().slice(0, TITLE_MAX_LENGTH).trimEnd() ?? '';
  if (title && title.toLowerCase() !== GENERIC_TITLE) return title;
  const date = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: FALLBACK_TIME_ZONES[locale],
  }).format(createdAt);
  return `Quiz ${date}`;
}

function parsedDate(value: string, fallback: Date): Date {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function viewOf(record: GuestDraftRecord, progressPercent = 0): GuestDraftView {
  return {
    status: record.status,
    progressPercent: record.complete ? 100 : progressPercent,
    title: record.title,
    questionCount: record.questionCount,
    complete: record.complete,
    completion: record.completion,
    failureReason: record.failureReason,
  };
}

function upstreamCompletion(draft: UpstreamGuestDraft): GuestDraftCompletion {
  return draft.completion === 'first_batch_only' ? 'first_batch_only' : 'full';
}

function upstreamError({ status, code, meta }: UpstreamFailure): GuestDraftResult {
  return { ok: false, error: 'upstream', status, code, meta };
}

/** A 4xx means the API refused before extracting; a timeout or 5xx may have started paid work. */
function apiRefused(status: number): boolean {
  return status >= 400 && status < 500;
}

function isIndex(value: unknown, options: readonly string[]): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) < options.length;
}

/** Keeps only questions the Quiz question schema accepts; images are dropped for guests. */
function toGuestQuestion(source: UpstreamQuestion): GuestDraftQuestion | null {
  const question = source.question?.trim() ?? '';
  const { options } = source;
  if (!question || options.length < 2) return null;
  if (source.type === 'single') {
    return isIndex(source.correctIndex, options)
      ? { question, options, type: 'single', correctIndex: source.correctIndex }
      : null;
  }
  const correctIndexes = [...new Set(source.correctIndexes ?? [])];
  return correctIndexes.length > 0 && correctIndexes.every((index) => isIndex(index, options))
    ? { question, options, type: 'multiple', correctIndexes }
    : null;
}

/**
 * The questions a guest may play, in the API's order. The filter is per question and the
 * API only appends (RIN-1617), so the questions of an earlier poll are a prefix of these.
 */
function guestQuestions(draft: UpstreamGuestDraft): GuestDraftQuestion[] {
  return (draft.questions ?? [])
    .map(toGuestQuestion)
    .filter((question): question is GuestDraftQuestion => question !== null);
}

/**
 * Guest quiz drafts (RIN-1446). The API extracts; this service keeps the result in its
 * own collection and never hands the API draft id or the token hash to the browser.
 * A draft is playable with the API's first batch while the rest is extracted (RIN-1619).
 */
export class GuestDraftService implements IGuestDraftService, GuestDraftRefresher {
  constructor(
    private readonly repository: IGuestQuizDraftRepository,
    private readonly limiter: GuestDraftLimiter,
    private readonly upstream: GuestDraftUpstream,
    private readonly events: GuestDraftEvents,
    private readonly now: Clock = () => new Date(),
  ) {}

  create(input: GuestDraftCreateInput): Promise<GuestDraftResult> {
    return this.start(input, 'pdf', () => this.upstream.create(input.pdf));
  }

  /** Pasted text (RIN-1538): the same caps budget, attempt record and events as a PDF. */
  createFromText(input: GuestTextDraftCreateInput): Promise<GuestDraftResult> {
    const { sourceFileType } = input;
    return this.start(input, 'text', () =>
      this.upstream.createFromText(input.text, sourceFileType),
    );
  }

  private async start(
    input: StartInput,
    source: GuestDraftSource,
    createUpstream: UpstreamStart,
  ): Promise<GuestDraftResult> {
    const tokenHash = hashGuestClaimToken(input.token);
    if (await this.repository.findByTokenHash(tokenHash)) {
      return { ok: false, error: 'token_in_use' };
    }
    const reservation = await this.limiter.reserve(input.ip);
    if (!reservation.ok) {
      const { scope, retryAfterSeconds } = reservation;
      return { ok: false, error: 'limit', scope, retryAfterSeconds };
    }
    const created = await createUpstream();
    if (!created.ok) {
      // No draft for the guest: the IP slot comes back. The daily slot comes back only when
      // the API refused outright; after a timeout or 5xx extraction may already be running.
      await Promise.all([
        this.limiter.refundIp(input.ip),
        apiRefused(created.status) ? this.limiter.refundDaily() : undefined,
      ]);
      return upstreamError(created);
    }
    const record = await this.repository.create({
      tokenHash,
      apiDraftId: created.draft.draft_id,
      locale: input.locale,
      entry: input.entry,
      source,
      ...(input.sourceFileType ? { sourceFileType: input.sourceFileType } : {}),
      expiresAt: new Date(this.now().getTime() + GUEST_DRAFT_TTL_MS),
    });
    await this.events.started(this.context(record));
    return { ok: true, draft: viewOf(record, created.draft.progress.percent ?? 0) };
  }

  status(token: string, ip: string | null): Promise<GuestDraftResult> {
    return this.statusByHash(hashGuestClaimToken(token), ip);
  }

  async refreshHashed(tokenHash: string): Promise<void> {
    await this.statusByHash(tokenHash, null);
  }

  releaseUpstream(apiDraftId: string): Promise<void> {
    return this.upstream.remove(apiDraftId);
  }

  /**
   * One poll. A processing draft becomes playable with its first batch and keeps asking
   * the API until the rest is appended; a complete or failed draft never asks again.
   */
  private async statusByHash(tokenHash: string, ip: string | null): Promise<GuestDraftResult> {
    const record = await this.repository.findByTokenHash(tokenHash);
    if (!record) return { ok: false, error: 'not_found' };
    if (record.status === 'failed' || record.complete) return { ok: true, draft: viewOf(record) };

    const upstream = await this.upstream.get(record.apiDraftId);
    if (!upstream.ok) {
      // A draft the API no longer has will never finish.
      if (upstream.status === 404) return this.upstreamEnded(tokenHash, record, 'expired', ip);
      // A playable first batch stays playable: the next poll asks again.
      if (record.status === 'ready') return { ok: true, draft: viewOf(record) };
      return upstreamError(upstream);
    }
    const { draft } = upstream;
    if (draft.status === 'completed') {
      return record.status === 'ready'
        ? this.appendRest(tokenHash, record, draft)
        : this.ready(tokenHash, record, draft, ip);
    }
    if (FAILED_UPSTREAM_STATUSES.has(draft.status)) {
      return this.upstreamEnded(tokenHash, record, draft.failure_reason ?? draft.status, ip);
    }
    const progress = draft.progress.percent ?? 0;
    if (record.status === 'processing' && (draft.questions_ready ?? 0) > 0) {
      return this.firstBatch(tokenHash, record, draft, progress);
    }
    return { ok: true, draft: viewOf(record, progress) };
  }

  /** After a first batch the learner keeps it: no failed draft, refund or failed event. */
  private upstreamEnded(
    tokenHash: string,
    record: GuestDraftRecord,
    reason: string,
    ip: string | null,
  ): Promise<GuestDraftResult> {
    if (record.status !== 'ready') return this.fail(tokenHash, record, reason, ip);
    return this.complete(tokenHash, record, {
      storedCount: record.questionCount,
      questions: [],
      completion: 'first_batch_only',
    });
  }

  private async firstBatch(
    tokenHash: string,
    record: GuestDraftRecord,
    draft: UpstreamGuestDraft,
    progress: number,
  ): Promise<GuestDraftResult> {
    const questions = guestQuestions(draft);
    if (questions.length === 0) return { ok: true, draft: viewOf(record, progress) };
    // The API names the topic only on completion: the dated fallback until then.
    const title = this.titleOf(record, draft);
    if (!(await this.repository.storeFirstBatch(record.id, { title, questions }))) {
      return this.storedView(tokenHash);
    }
    await this.events.firstBatchReady(this.context(record), this.msSinceSubmit(record));
    const stored = { title, questionCount: questions.length, complete: false, completion: null };
    return { ok: true, draft: viewOf({ ...record, ...stored, status: 'ready' }, progress) };
  }

  /** Appends only what lies beyond the stored questions: those are never reordered or replaced. */
  private appendRest(
    tokenHash: string,
    record: GuestDraftRecord,
    draft: UpstreamGuestDraft,
  ): Promise<GuestDraftResult> {
    const update: GuestDraftCompleteUpdate = {
      storedCount: record.questionCount,
      questions: guestQuestions(draft).slice(record.questionCount),
      title: this.titleOf(record, draft),
      completion: upstreamCompletion(draft),
    };
    return this.complete(tokenHash, record, update, true);
  }

  private async complete(
    tokenHash: string,
    record: GuestDraftRecord,
    update: GuestDraftCompleteUpdate,
    upstreamCompleted = false,
  ): Promise<GuestDraftResult> {
    const won = await this.repository.completeDraft(record.id, update);
    await this.upstream.remove(record.apiDraftId);
    if (!won) return this.storedView(tokenHash);
    if (upstreamCompleted) await this.events.ready(this.context(record));
    const completed = {
      title: update.title ?? record.title,
      questionCount: update.storedCount + update.questions.length,
      complete: true,
      completion: update.completion,
    };
    return { ok: true, draft: viewOf({ ...record, ...completed }) };
  }

  /** The API completed with no partial step: one `ready`, as before RIN-1619. */
  private async ready(
    tokenHash: string,
    record: GuestDraftRecord,
    draft: UpstreamGuestDraft,
    ip: string | null,
  ): Promise<GuestDraftResult> {
    const questions = guestQuestions(draft);
    if (questions.length === 0) return this.fail(tokenHash, record, 'no_questions', ip);

    const title = this.titleOf(record, draft);
    const completion = upstreamCompletion(draft);
    const won = await this.repository.markReady(record.id, {
      title,
      questions,
      ...(completion === 'full' ? {} : { completion }),
    });
    await this.upstream.remove(record.apiDraftId);
    if (!won) return this.storedView(tokenHash);
    // first_batch_ready means "playable" for every draft, so it is sent here too.
    await this.events.firstBatchReady(this.context(record), this.msSinceSubmit(record));
    await this.events.ready(this.context(record));
    const stored = { title, questionCount: questions.length, complete: true, completion };
    return { ok: true, draft: viewOf({ ...record, ...stored, status: 'ready' }) };
  }

  private async fail(
    tokenHash: string,
    record: GuestDraftRecord,
    reason: string,
    ip: string | null,
  ): Promise<GuestDraftResult> {
    const won = await this.repository.markFailed(record.id, reason);
    await this.upstream.remove(record.apiDraftId);
    if (!won) return this.storedView(tokenHash);
    // AC8: a failure gives the per-IP slot back; the global slot stays spent.
    await this.limiter.refundIp(ip);
    await this.events.failed(this.context(record), reason);
    return { ok: true, draft: viewOf({ ...record, status: 'failed', failureReason: reason }) };
  }

  /**
   * A concurrent poll settled the draft first (e.g. it marked it ready and deleted the API
   * draft, so this poll saw a 404): answer with what was stored, never this poll's guess.
   */
  private async storedView(tokenHash: string): Promise<GuestDraftResult> {
    const stored = await this.repository.findByTokenHash(tokenHash);
    return stored ? { ok: true, draft: viewOf(stored) } : { ok: false, error: 'not_found' };
  }

  private titleOf(record: GuestDraftRecord, draft: UpstreamGuestDraft): string {
    return guestDraftTitle(draft.title, record.locale, parsedDate(draft.created_at, this.now()));
  }

  private msSinceSubmit(record: GuestDraftRecord): number {
    return Math.max(0, this.now().getTime() - record.createdAt.getTime());
  }

  private context(record: GuestDraftRecord): GuestDraftEventContext {
    return {
      draftId: record.id,
      locale: record.locale,
      entry: record.entry,
      source: record.source,
      fileType: record.sourceFileType,
    };
  }
}
