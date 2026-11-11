import type {
  GuestDraftQuestion,
  GuestDraftRecord,
  IGuestQuizDraftRepository,
} from '@/interfaces/repositories/IGuestQuizDraftRepository';
import type {
  GuestDraftCreateInput,
  GuestDraftEvents,
  GuestDraftLimiter,
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
import { GUEST_DRAFT_TTL_MS, type GuestDraftSource } from '@/shared/constants/guest-draft';

type Clock = () => Date;
type UpstreamQuestion = NonNullable<UpstreamGuestDraft['questions']>[number];
type UpstreamFailure = Extract<UpstreamGuestDraftResult, { ok: false }>;
type StartInput = Omit<GuestDraftCreateInput, 'pdf'>;
type UpstreamStart = () => Promise<UpstreamGuestDraftResult>;

const FAILED_UPSTREAM_STATUSES = new Set(['failed', 'cancelled', 'expired']);

function viewOf(record: GuestDraftRecord, progressPercent = 0): GuestDraftView {
  return {
    status: record.status,
    progressPercent: record.status === 'ready' ? 100 : progressPercent,
    title: record.title,
    questionCount: record.questionCount,
    failureReason: record.failureReason,
  };
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
 * Guest quiz drafts (RIN-1446). The API extracts; this service keeps the result in its
 * own collection and never hands the API draft id or the token hash to the browser.
 */
export class GuestDraftService implements IGuestDraftService {
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
    return this.start(input, 'text', () => this.upstream.createFromText(input.text));
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
      expiresAt: new Date(this.now().getTime() + GUEST_DRAFT_TTL_MS),
    });
    await this.events.started(this.context(record));
    return { ok: true, draft: viewOf(record, created.draft.progress.percent ?? 0) };
  }

  async status(token: string, ip: string | null): Promise<GuestDraftResult> {
    const tokenHash = hashGuestClaimToken(token);
    const record = await this.repository.findByTokenHash(tokenHash);
    if (!record) return { ok: false, error: 'not_found' };
    if (record.status !== 'processing') return { ok: true, draft: viewOf(record) };

    const upstream = await this.upstream.get(record.apiDraftId);
    if (!upstream.ok) {
      // A draft the API no longer has will never finish.
      if (upstream.status === 404) return this.fail(tokenHash, record, 'expired', ip);
      return upstreamError(upstream);
    }
    const { draft } = upstream;
    if (draft.status === 'completed') return this.ready(tokenHash, record, draft, ip);
    if (FAILED_UPSTREAM_STATUSES.has(draft.status)) {
      return this.fail(tokenHash, record, draft.failure_reason ?? draft.status, ip);
    }
    return { ok: true, draft: viewOf(record, draft.progress.percent ?? 0) };
  }

  private async ready(
    tokenHash: string,
    record: GuestDraftRecord,
    draft: UpstreamGuestDraft,
    ip: string | null,
  ): Promise<GuestDraftResult> {
    const questions = (draft.questions ?? [])
      .map(toGuestQuestion)
      .filter((question): question is GuestDraftQuestion => question !== null);
    if (questions.length === 0) return this.fail(tokenHash, record, 'no_questions', ip);

    const title = draft.title?.trim() || 'Quiz';
    const won = await this.repository.markReady(record.id, { title, questions });
    await this.upstream.remove(record.apiDraftId);
    if (!won) return this.storedView(tokenHash);
    await this.events.ready(this.context(record));
    return {
      ok: true,
      draft: viewOf({ ...record, status: 'ready', title, questionCount: questions.length }),
    };
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

  private context(record: GuestDraftRecord): GuestDraftEventContext {
    return {
      draftId: record.id,
      locale: record.locale,
      entry: record.entry,
      source: record.source,
    };
  }
}
