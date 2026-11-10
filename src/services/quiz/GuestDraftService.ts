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
  UpstreamGuestDraft,
} from '@/interfaces/services/IGuestDraftService';
import { hashGuestClaimToken } from '@/lib/guest-claim-token';
import { GUEST_DRAFT_TTL_MS } from '@/shared/constants/guest-draft';

type Clock = () => Date;
type UpstreamQuestion = UpstreamGuestDraft['questions'][number];

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

  async create(input: GuestDraftCreateInput): Promise<GuestDraftResult> {
    const tokenHash = hashGuestClaimToken(input.token);
    if (await this.repository.findByTokenHash(tokenHash)) {
      return { ok: false, error: 'token_in_use' };
    }
    const reservation = await this.limiter.reserve(input.ip);
    if (!reservation.ok) {
      return { ok: false, error: 'limit', ...reservation };
    }
    const created = await this.upstream.create(input.pdf);
    if (!created.ok) {
      // No draft was made, so neither slot paid for anything.
      await Promise.all([this.limiter.refundIp(input.ip), this.limiter.refundDaily()]);
      return { ok: false, error: 'upstream', ...created };
    }
    const record = await this.repository.create({
      tokenHash,
      apiDraftId: created.draft.draft_id,
      locale: input.locale,
      entry: input.entry,
      expiresAt: new Date(this.now().getTime() + GUEST_DRAFT_TTL_MS),
    });
    await this.events.started({ draftId: record.id, locale: record.locale, entry: record.entry });
    return { ok: true, draft: viewOf(record, created.draft.progress.percent ?? 0) };
  }

  async status(token: string, ip: string | null): Promise<GuestDraftResult> {
    const record = await this.repository.findByTokenHash(hashGuestClaimToken(token));
    if (!record) return { ok: false, error: 'not_found' };
    if (record.status !== 'processing') return { ok: true, draft: viewOf(record) };

    const upstream = await this.upstream.get(record.apiDraftId);
    if (!upstream.ok) {
      // A draft the API no longer has will never finish.
      if (upstream.status === 404) return this.fail(record, 'expired', ip);
      return { ok: false, error: 'upstream', ...upstream };
    }
    const { draft } = upstream;
    if (draft.status === 'completed') return this.ready(record, draft, ip);
    if (FAILED_UPSTREAM_STATUSES.has(draft.status)) {
      return this.fail(record, draft.failure_reason ?? draft.status, ip);
    }
    return { ok: true, draft: viewOf(record, draft.progress.percent ?? 0) };
  }

  private async ready(
    record: GuestDraftRecord,
    draft: UpstreamGuestDraft,
    ip: string | null,
  ): Promise<GuestDraftResult> {
    const questions = (draft.questions ?? [])
      .map(toGuestQuestion)
      .filter((question): question is GuestDraftQuestion => question !== null);
    if (questions.length === 0) return this.fail(record, 'no_questions', ip);

    const title = draft.title?.trim() || 'Quiz';
    const won = await this.repository.markReady(record.id, { title, questions });
    if (won) await this.events.ready(this.context(record));
    await this.upstream.remove(record.apiDraftId);
    return {
      ok: true,
      draft: viewOf({ ...record, status: 'ready', title, questionCount: questions.length }),
    };
  }

  private async fail(
    record: GuestDraftRecord,
    reason: string,
    ip: string | null,
  ): Promise<GuestDraftResult> {
    const won = await this.repository.markFailed(record.id, reason);
    if (won) {
      // AC8: a failure gives the per-IP slot back; the global slot stays spent.
      await this.limiter.refundIp(ip);
      await this.events.failed(this.context(record), reason);
    }
    await this.upstream.remove(record.apiDraftId);
    return { ok: true, draft: viewOf({ ...record, status: 'failed', failureReason: reason }) };
  }

  private context(record: GuestDraftRecord) {
    return { draftId: record.id, locale: record.locale, entry: record.entry };
  }
}
