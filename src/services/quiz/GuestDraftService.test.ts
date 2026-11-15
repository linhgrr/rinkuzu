import { describe, expect, it, vi } from 'vitest';

import type {
  GuestDraftRecord,
  IGuestQuizDraftRepository,
} from '@/interfaces/repositories/IGuestQuizDraftRepository';
import type {
  GuestDraftEvents,
  GuestDraftLimiter,
  GuestDraftUpstream,
  UpstreamGuestDraft,
} from '@/interfaces/services/IGuestDraftService';
import { hashGuestClaimToken } from '@/lib/guest-claim-token';
import { GuestDraftService } from '@/services/quiz/GuestDraftService';

const TOKEN = 'T'.repeat(43);
const NOW = new Date('2026-11-10T03:00:00.000Z');
const IP = '203.0.113.7';

const SUBMITTED_AT = new Date('2026-11-10T02:59:52.000Z');

/** A `ready` record is complete unless the test says otherwise (RIN-1619). */
function record(overrides: Partial<GuestDraftRecord> = {}): GuestDraftRecord {
  const complete = overrides.status === 'ready';
  return {
    id: '6730a0000000000000000001',
    apiDraftId: 'api-draft-1',
    status: 'processing',
    title: null,
    questionCount: 0,
    complete,
    completion: complete ? 'full' : null,
    locale: 'en',
    entry: 'landing',
    source: 'pdf',
    failureReason: null,
    createdAt: SUBMITTED_AT,
    ...overrides,
  };
}

function upstreamDraft(overrides: Partial<UpstreamGuestDraft> = {}): UpstreamGuestDraft {
  return {
    draft_id: 'api-draft-1',
    status: 'processing',
    progress: { processed: 1, total: 4, percent: 25 },
    title: null,
    question_count: 0,
    questions: [],
    failure_reason: null,
    created_at: NOW.toISOString(),
    expires_at: null,
    ...overrides,
  };
}

type UpstreamQuestions = NonNullable<UpstreamGuestDraft['questions']>;
const brokenQuestion: UpstreamQuestions[number] = {
  question: 'broken',
  type: 'single',
  options: ['a', 'b'],
  correctIndex: 5,
};
const readyQuestions: UpstreamQuestions = [
  { question: 'Q1?', type: 'single', options: ['a', 'b'], correctIndex: 1 },
  { question: 'Q2?', type: 'multiple', options: ['a', 'b', 'c'], correctIndexes: [0, 2] },
  brokenQuestion,
];

function setup(existing: GuestDraftRecord | null = null) {
  const repository = {
    create: vi.fn(async (draft) =>
      record({ apiDraftId: draft.apiDraftId, entry: draft.entry, source: draft.source }),
    ),
    findByTokenHash: vi.fn(async () => existing),
    markReady: vi.fn<IGuestQuizDraftRepository['markReady']>(async () => true),
    markFailed: vi.fn(async () => true),
    storeFirstBatch: vi.fn<IGuestQuizDraftRepository['storeFirstBatch']>(async () => true),
    completeDraft: vi.fn<IGuestQuizDraftRepository['completeDraft']>(async () => true),
  } satisfies IGuestQuizDraftRepository;
  const limiter = {
    reserve: vi.fn<GuestDraftLimiter['reserve']>(async () => ({ ok: true })),
    refundIp: vi.fn(async () => undefined),
    refundDaily: vi.fn(async () => undefined),
  } satisfies GuestDraftLimiter;
  const upstream = {
    create: vi.fn<GuestDraftUpstream['create']>(async () => ({
      ok: true,
      draft: upstreamDraft({ status: 'queued' }),
    })),
    createFromText: vi.fn<GuestDraftUpstream['createFromText']>(async () => ({
      ok: true,
      draft: upstreamDraft({ status: 'queued' }),
    })),
    get: vi.fn<GuestDraftUpstream['get']>(async () => ({ ok: true, draft: upstreamDraft() })),
    remove: vi.fn(async () => undefined),
  } satisfies GuestDraftUpstream;
  const events = {
    started: vi.fn(async () => undefined),
    firstBatchReady: vi.fn(async () => undefined),
    ready: vi.fn(async () => undefined),
    failed: vi.fn(async () => undefined),
    claimed: vi.fn(async () => undefined),
  } satisfies GuestDraftEvents;
  const service = new GuestDraftService(repository, limiter, upstream, events, () => NOW);
  return { service, repository, limiter, upstream, events };
}

const pdf = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
const createInput = { token: TOKEN, pdf, locale: 'en' as const, entry: 'landing' as const, ip: IP };

describe('GuestDraftService.create', () => {
  it('stores only the token hash with a 24 h expiry and emits started', async () => {
    const { service, repository, upstream, events } = setup();

    const result = await service.create(createInput);

    expect(result).toMatchObject({ ok: true, draft: { status: 'processing' } });
    expect(upstream.create).toHaveBeenCalledWith(pdf);
    expect(repository.create).toHaveBeenCalledWith({
      tokenHash: hashGuestClaimToken(TOKEN),
      apiDraftId: 'api-draft-1',
      locale: 'en',
      entry: 'landing',
      source: 'pdf',
      expiresAt: new Date('2026-11-11T03:00:00.000Z'),
    });
    expect(JSON.stringify(repository.create.mock.calls)).not.toContain(TOKEN);
    expect(events.started).toHaveBeenCalledWith({
      draftId: '6730a0000000000000000001',
      locale: 'en',
      entry: 'landing',
      source: 'pdf',
    });
  });

  it.each(['ip', 'daily'] as const)('a hit %s cap never calls the API', async (scope) => {
    const { service, limiter, upstream, repository } = setup();
    limiter.reserve.mockResolvedValue({ ok: false, scope, retryAfterSeconds: 60 });

    const result = await service.create(createInput);

    expect(result).toEqual({ ok: false, error: 'limit', scope, retryAfterSeconds: 60 });
    expect(upstream.create).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('refunds both slots when the API refuses the upload with a 4xx', async () => {
    const { service, limiter, repository, upstream, events } = setup();
    upstream.create.mockResolvedValue({
      ok: false,
      status: 413,
      code: 'validation_error',
      meta: { reason: 'guest_pdf_too_large', limit_pages: 10 },
    });

    const result = await service.create(createInput);

    expect(result).toMatchObject({ ok: false, error: 'upstream', status: 413 });
    expect(limiter.refundIp).toHaveBeenCalledWith(IP);
    expect(limiter.refundDaily).toHaveBeenCalledOnce();
    expect(repository.create).not.toHaveBeenCalled();
    expect(events.started).not.toHaveBeenCalled();
  });

  it.each([503, 504, 500])(
    'keeps the daily slot spent when the API answered %s (it may already be extracting)',
    async (status) => {
      const { service, limiter, upstream } = setup();
      upstream.create.mockResolvedValue({
        ok: false,
        status,
        code: 'service_unavailable',
        meta: null,
      });

      const result = await service.create(createInput);

      expect(result).toMatchObject({ ok: false, error: 'upstream', status });
      expect(limiter.refundIp).toHaveBeenCalledWith(IP);
      expect(limiter.refundDaily).not.toHaveBeenCalled();
    },
  );

  it('refuses a token already used before touching the caps', async () => {
    const { service, limiter } = setup(record());

    expect(await service.create(createInput)).toEqual({ ok: false, error: 'token_in_use' });
    expect(limiter.reserve).not.toHaveBeenCalled();
  });
});

const PASTED = 'Fake notes about cells. '.repeat(20);
const textInput = {
  token: TOKEN,
  text: PASTED,
  locale: 'en' as const,
  entry: 'create' as const,
  ip: IP,
};

describe('GuestDraftService.createFromText (RIN-1538)', () => {
  it('starts a text draft through the same caps, stores no text and emits source text', async () => {
    const { service, repository, limiter, upstream, events } = setup();

    const result = await service.createFromText(textInput);

    expect(result).toMatchObject({ ok: true, draft: { status: 'processing' } });
    expect(limiter.reserve).toHaveBeenCalledWith(IP);
    expect(upstream.createFromText).toHaveBeenCalledWith(PASTED);
    expect(upstream.create).not.toHaveBeenCalled();
    expect(repository.create).toHaveBeenCalledWith({
      tokenHash: hashGuestClaimToken(TOKEN),
      apiDraftId: 'api-draft-1',
      locale: 'en',
      entry: 'create',
      source: 'text',
      expiresAt: new Date('2026-11-11T03:00:00.000Z'),
    });
    expect(events.started).toHaveBeenCalledWith({
      draftId: '6730a0000000000000000001',
      locale: 'en',
      entry: 'create',
      source: 'text',
    });
    const stored = JSON.stringify([repository.create.mock.calls, events.started.mock.calls]);
    expect(stored).not.toContain('Fake notes');
    expect(stored).not.toContain(TOKEN);
  });

  it.each(['ip', 'daily'] as const)(
    'shares the PDF budget: a %s cap spent by PDF drafts refuses a text draft',
    async (scope) => {
      const { service, limiter, upstream, repository } = setup();
      // One limiter for both sources: the reservation a PDF would make is the same call.
      limiter.reserve.mockResolvedValue({ ok: false, scope, retryAfterSeconds: 60 });

      const result = await service.createFromText(textInput);

      expect(result).toEqual({ ok: false, error: 'limit', scope, retryAfterSeconds: 60 });
      expect(upstream.createFromText).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    },
  );

  it('refunds both slots when the API refuses the text with a 4xx', async () => {
    const { service, limiter, upstream } = setup();
    upstream.createFromText.mockResolvedValue({
      ok: false,
      status: 422,
      code: 'validation_error',
      meta: { reason: 'guest_text_too_short', limit_chars: 200 },
    });

    const result = await service.createFromText(textInput);

    expect(result).toMatchObject({ ok: false, error: 'upstream', status: 422 });
    expect(limiter.refundIp).toHaveBeenCalledWith(IP);
    expect(limiter.refundDaily).toHaveBeenCalledOnce();
  });

  it('refuses a token already used by any guest draft before touching the caps', async () => {
    const { service, limiter } = setup(record());

    expect(await service.createFromText(textInput)).toEqual({ ok: false, error: 'token_in_use' });
    expect(limiter.reserve).not.toHaveBeenCalled();
  });

  it('carries source text on ready and failed', async () => {
    const ready = setup(record({ source: 'text' }));
    ready.upstream.get.mockResolvedValue({
      ok: true,
      draft: upstreamDraft({ status: 'completed', title: 'T', questions: readyQuestions }),
    });
    await ready.service.status(TOKEN, IP);
    expect(ready.events.ready).toHaveBeenCalledWith(expect.objectContaining({ source: 'text' }));

    const failed = setup(record({ source: 'text' }));
    failed.upstream.get.mockResolvedValue({
      ok: true,
      draft: upstreamDraft({ status: 'failed', failure_reason: 'no_questions' }),
    });
    await failed.service.status(TOKEN, IP);
    expect(failed.events.failed).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'text' }),
      'no_questions',
    );
  });
});

describe('GuestDraftService.status', () => {
  it('404s an unknown token', async () => {
    const { service, upstream } = setup(null);
    expect(await service.status(TOKEN, IP)).toEqual({ ok: false, error: 'not_found' });
    expect(upstream.get).not.toHaveBeenCalled();
  });

  it('reports progress while the API extracts', async () => {
    const { service, repository } = setup(record());
    const result = await service.status(TOKEN, IP);
    expect(result).toMatchObject({
      ok: true,
      draft: { status: 'processing', progressPercent: 25 },
    });
    expect(repository.markReady).not.toHaveBeenCalled();
  });

  it('on the first ready copies valid questions, emits ready and deletes upstream', async () => {
    const { service, repository, upstream, events } = setup(record());
    upstream.get.mockResolvedValue({
      ok: true,
      draft: upstreamDraft({ status: 'completed', title: ' Cells ', questions: readyQuestions }),
    });

    const result = await service.status(TOKEN, IP);

    expect(result).toMatchObject({
      ok: true,
      draft: { status: 'ready', title: 'Cells', questionCount: 2, progressPercent: 100 },
    });
    expect(repository.markReady).toHaveBeenCalledWith('6730a0000000000000000001', {
      title: 'Cells',
      questions: [
        { question: 'Q1?', options: ['a', 'b'], type: 'single', correctIndex: 1 },
        { question: 'Q2?', options: ['a', 'b', 'c'], type: 'multiple', correctIndexes: [0, 2] },
      ],
    });
    expect(events.ready).toHaveBeenCalledOnce();
    expect(upstream.remove).toHaveBeenCalledWith('api-draft-1');
  });

  it('a poll that loses the ready race emits nothing more', async () => {
    const { service, repository, upstream, events } = setup(record());
    upstream.get.mockResolvedValue({
      ok: true,
      draft: upstreamDraft({ status: 'completed', questions: readyQuestions }),
    });
    repository.markReady.mockResolvedValue(false);
    repository.findByTokenHash
      .mockResolvedValueOnce(record())
      .mockResolvedValueOnce(record({ status: 'ready', title: 'Stored', questionCount: 2 }));

    const result = await service.status(TOKEN, IP);

    expect(result).toMatchObject({ ok: true, draft: { status: 'ready', title: 'Stored' } });
    expect(events.ready).not.toHaveBeenCalled();
  });

  it('a poll that loses markFailed to a ready poll answers ready, not failed', async () => {
    // Poll A marked the draft ready and deleted it upstream; poll B then sees a 404.
    const { service, repository, upstream, limiter, events } = setup(record());
    upstream.get.mockResolvedValue({ ok: false, status: 404, code: 'not_found', meta: null });
    repository.markFailed.mockResolvedValue(false);
    repository.findByTokenHash
      .mockResolvedValueOnce(record())
      .mockResolvedValueOnce(record({ status: 'ready', title: 'Cells', questionCount: 2 }));

    const result = await service.status(TOKEN, IP);

    expect(result).toEqual({
      ok: true,
      draft: {
        status: 'ready',
        progressPercent: 100,
        title: 'Cells',
        questionCount: 2,
        complete: true,
        completion: 'full',
        failureReason: null,
      },
    });
    expect(limiter.refundIp).not.toHaveBeenCalled();
    expect(events.failed).not.toHaveBeenCalled();
  });

  it('a lost transition on a draft the TTL already removed answers not_found', async () => {
    const { service, repository, upstream } = setup(record());
    upstream.get.mockResolvedValue({ ok: false, status: 404, code: 'not_found', meta: null });
    repository.markFailed.mockResolvedValue(false);
    repository.findByTokenHash.mockResolvedValueOnce(record()).mockResolvedValueOnce(null);

    expect(await service.status(TOKEN, IP)).toEqual({ ok: false, error: 'not_found' });
  });

  it('serves a stored ready draft without calling the API again', async () => {
    const { service, upstream } = setup(record({ status: 'ready', title: 'T', questionCount: 3 }));
    const result = await service.status(TOKEN, IP);
    expect(result).toMatchObject({ ok: true, draft: { status: 'ready', questionCount: 3 } });
    expect(upstream.get).not.toHaveBeenCalled();
    expect(upstream.remove).not.toHaveBeenCalled();
  });

  it('a failure refunds only the per-IP slot, once, and emits failed with the reason', async () => {
    const { service, repository, limiter, upstream, events } = setup(record());
    upstream.get.mockResolvedValue({
      ok: true,
      draft: upstreamDraft({ status: 'failed', failure_reason: 'ocr_failed' }),
    });

    const result = await service.status(TOKEN, IP);

    expect(result).toMatchObject({
      ok: true,
      draft: { status: 'failed', failureReason: 'ocr_failed' },
    });
    expect(repository.markFailed).toHaveBeenCalledWith('6730a0000000000000000001', 'ocr_failed');
    expect(limiter.refundIp).toHaveBeenCalledWith(IP);
    expect(limiter.refundDaily).not.toHaveBeenCalled();
    expect(events.failed).toHaveBeenCalledWith(
      { draftId: '6730a0000000000000000001', locale: 'en', entry: 'landing', source: 'pdf' },
      'ocr_failed',
    );
    expect(upstream.remove).toHaveBeenCalledWith('api-draft-1');

    repository.markFailed.mockResolvedValue(false);
    await service.status(TOKEN, IP);
    expect(limiter.refundIp).toHaveBeenCalledOnce();
    expect(events.failed).toHaveBeenCalledOnce();
  });

  it('a ready draft with no usable question fails as no_questions', async () => {
    const { service, repository, upstream } = setup(record());
    upstream.get.mockResolvedValue({
      ok: true,
      draft: upstreamDraft({ status: 'completed', questions: [brokenQuestion] }),
    });

    await service.status(TOKEN, IP);

    expect(repository.markFailed).toHaveBeenCalledWith(expect.any(String), 'no_questions');
    expect(repository.markReady).not.toHaveBeenCalled();
  });

  it('treats a draft the API no longer has as expired', async () => {
    const { service, repository, upstream } = setup(record());
    upstream.get.mockResolvedValue({ ok: false, status: 404, code: 'not_found', meta: null });
    await service.status(TOKEN, IP);
    expect(repository.markFailed).toHaveBeenCalledWith(expect.any(String), 'expired');
  });

  it('passes a transient API error through without failing the draft', async () => {
    const { service, repository, upstream } = setup(record());
    upstream.get.mockResolvedValue({ ok: false, status: 503, code: null, meta: null });
    expect(await service.status(TOKEN, IP)).toMatchObject({ ok: false, error: 'upstream' });
    expect(repository.markFailed).not.toHaveBeenCalled();
  });
});

describe('GuestDraftService ready title (RIN-1546)', () => {
  async function readyTitle(
    title: string | null,
    locale: 'vi' | 'en' = 'en',
    createdAt = '2026-11-11T03:00:00.000Z',
  ) {
    const { service, repository, upstream } = setup(record({ locale }));
    upstream.get.mockResolvedValue({
      ok: true,
      draft: upstreamDraft({
        status: 'completed',
        title,
        questions: readyQuestions,
        created_at: createdAt,
      }),
    });
    const result = await service.status(TOKEN, IP);
    const stored = repository.markReady.mock.calls[0]?.[1]?.title;
    expect(result).toMatchObject({ ok: true, draft: { status: 'ready', title: stored } });
    return stored;
  }

  it('keeps the topic title the API sent', async () => {
    expect(await readyTitle('Cell biology: mitosis')).toBe('Cell biology: mitosis');
  });

  it.each([null, '', '   ', 'Quiz', ' quiz ', 'QUIZ'])(
    'replaces the unusable title %j with a dated fallback in en',
    async (title) => {
      expect(await readyTitle(title, 'en')).toBe('Quiz 11/11/2026');
    },
  );

  it('dates the vi fallback day first, in Vietnam time', async () => {
    // 18:30 UTC on 10 Nov is already 11 Nov in Hanoi.
    expect(await readyTitle(null, 'vi', '2026-11-10T18:30:00.000Z')).toBe('Quiz 11/11/2026');
    expect(await readyTitle('Quiz', 'vi', '2026-03-04T03:00:00.000Z')).toBe('Quiz 04/03/2026');
  });

  it('dates the fallback with the poll time when the API creation date is unreadable', async () => {
    expect(await readyTitle(null, 'en', 'not a date')).toBe('Quiz 11/10/2026');
  });

  it('caps a long title at 60 characters', async () => {
    expect(await readyTitle(`  ${'A'.repeat(80)}  `)).toBe('A'.repeat(60));
    // A cut that lands on a space leaves no trailing blank.
    expect(await readyTitle('Mitosis and meiosis '.repeat(5))).toBe(
      'Mitosis and meiosis Mitosis and meiosis Mitosis and meiosis',
    );
  });

  it('never builds the title from the uploaded file name', async () => {
    const { service, repository, upstream } = setup();
    const named = new File(['%PDF-1.4'], 'Nguyen Van A - CV.pdf', { type: 'application/pdf' });
    await service.create({ ...createInput, pdf: named });
    repository.findByTokenHash.mockResolvedValue(record());
    upstream.get.mockResolvedValue({
      ok: true,
      draft: upstreamDraft({ status: 'completed', title: null, questions: readyQuestions }),
    });

    await service.status(TOKEN, IP);

    expect(repository.markReady.mock.calls[0]?.[1]?.title).toBe('Quiz 11/10/2026');
    expect(JSON.stringify(repository.create.mock.calls)).not.toContain('Nguyen');
  });
});

describe('GuestDraftService first batch (RIN-1619)', () => {
  const rest: UpstreamQuestions = [
    { question: 'Q3?', type: 'single', options: ['a', 'b'], correctIndex: 0 },
    brokenQuestion,
    { question: 'Q4?', type: 'single', options: ['a', 'b', 'c'], correctIndex: 2 },
  ];
  const stored = (count: number) => ({
    status: 'ready' as const,
    complete: false,
    completion: null,
    title: 'Quiz 11/10/2026',
    questionCount: count,
  });
  const context = {
    draftId: '6730a0000000000000000001',
    locale: 'en',
    entry: 'landing',
    source: 'pdf',
  };

  it('stores a partial first batch as playable, keeps the API draft, sends one first_batch_ready', async () => {
    const { service, repository, upstream, events } = setup(record());
    upstream.get.mockResolvedValue({
      ok: true,
      draft: upstreamDraft({
        questions_ready: 3,
        questions: readyQuestions,
        progress: { processed: 2, total: 4, percent: 50 },
      }),
    });

    const result = await service.status(TOKEN, IP);

    expect(result).toEqual({
      ok: true,
      draft: {
        status: 'ready',
        progressPercent: 50,
        title: 'Quiz 11/10/2026',
        questionCount: 2,
        complete: false,
        completion: null,
        failureReason: null,
      },
    });
    expect(repository.storeFirstBatch).toHaveBeenCalledWith('6730a0000000000000000001', {
      title: 'Quiz 11/10/2026',
      questions: [
        { question: 'Q1?', options: ['a', 'b'], type: 'single', correctIndex: 1 },
        { question: 'Q2?', options: ['a', 'b', 'c'], type: 'multiple', correctIndexes: [0, 2] },
      ],
    });
    expect(upstream.remove).not.toHaveBeenCalled();
    expect(events.firstBatchReady).toHaveBeenCalledExactlyOnceWith(context, 8000);
    expect(events.ready).not.toHaveBeenCalled();
  });

  it('keeps reporting progress while the API has no readable question yet', async () => {
    const { service, repository } = setup(record());
    expect(await service.status(TOKEN, IP)).toMatchObject({
      ok: true,
      draft: { status: 'processing', complete: false, completion: null },
    });
    expect(repository.storeFirstBatch).not.toHaveBeenCalled();
  });

  it('waits when the first batch holds no usable question', async () => {
    const { service, repository, upstream, events } = setup(record());
    upstream.get.mockResolvedValue({
      ok: true,
      draft: upstreamDraft({ questions_ready: 1, questions: [brokenQuestion] }),
    });
    expect(await service.status(TOKEN, IP)).toMatchObject({
      ok: true,
      draft: { status: 'processing' },
    });
    expect(repository.storeFirstBatch).not.toHaveBeenCalled();
    expect(events.firstBatchReady).not.toHaveBeenCalled();
  });

  it('a poll that loses the first-batch race answers what was stored and sends nothing', async () => {
    const { service, repository, upstream, events } = setup(record());
    upstream.get.mockResolvedValue({
      ok: true,
      draft: upstreamDraft({ questions_ready: 3, questions: readyQuestions }),
    });
    repository.storeFirstBatch.mockResolvedValue(false);
    repository.findByTokenHash
      .mockResolvedValueOnce(record())
      .mockResolvedValueOnce(record(stored(2)));

    expect(await service.status(TOKEN, IP)).toMatchObject({
      ok: true,
      draft: { questionCount: 2, complete: false },
    });
    expect(events.firstBatchReady).not.toHaveBeenCalled();
  });

  it('keeps polling an incomplete draft and answers its stored view meanwhile', async () => {
    const { service, repository, upstream } = setup(record(stored(2)));
    upstream.get.mockResolvedValue({
      ok: true,
      draft: upstreamDraft({
        questions_ready: 3,
        questions: readyQuestions,
        progress: { processed: 3, total: 4, percent: 75 },
      }),
    });

    expect(await service.status(TOKEN, IP)).toMatchObject({
      ok: true,
      draft: { status: 'ready', progressPercent: 75, questionCount: 2, complete: false },
    });
    expect(upstream.get).toHaveBeenCalledOnce();
    expect(repository.storeFirstBatch).not.toHaveBeenCalled();
    expect(repository.completeDraft).not.toHaveBeenCalled();
  });

  it('a transient API error on an incomplete draft keeps it playable', async () => {
    const { service, repository, upstream } = setup(record(stored(2)));
    upstream.get.mockResolvedValue({ ok: false, status: 503, code: null, meta: null });
    expect(await service.status(TOKEN, IP)).toMatchObject({
      ok: true,
      draft: { status: 'ready', complete: false },
    });
    expect(repository.completeDraft).not.toHaveBeenCalled();
  });

  it('on completion appends only the questions beyond the stored ones, then removes the API draft', async () => {
    const { service, repository, upstream, events } = setup(record(stored(2)));
    upstream.get.mockResolvedValue({
      ok: true,
      draft: upstreamDraft({
        status: 'completed',
        title: 'Cells',
        questions_ready: 6,
        questions: [...readyQuestions, ...rest],
      }),
    });

    const result = await service.status(TOKEN, IP);

    expect(repository.completeDraft).toHaveBeenCalledWith('6730a0000000000000000001', {
      storedCount: 2,
      questions: [
        { question: 'Q3?', options: ['a', 'b'], type: 'single', correctIndex: 0 },
        { question: 'Q4?', options: ['a', 'b', 'c'], type: 'single', correctIndex: 2 },
      ],
      title: 'Cells',
      completion: 'full',
    });
    expect(result).toEqual({
      ok: true,
      draft: {
        status: 'ready',
        progressPercent: 100,
        title: 'Cells',
        questionCount: 4,
        complete: true,
        completion: 'full',
        failureReason: null,
      },
    });
    expect(upstream.remove).toHaveBeenCalledWith('api-draft-1');
    expect(events.ready).toHaveBeenCalledExactlyOnceWith(context);
    expect(events.firstBatchReady).not.toHaveBeenCalled();
    expect(repository.markReady).not.toHaveBeenCalled();
  });

  it('a poll that loses the append race appends nothing more and sends no second ready', async () => {
    const { service, repository, upstream, events } = setup(record(stored(2)));
    upstream.get.mockResolvedValue({
      ok: true,
      draft: upstreamDraft({ status: 'completed', questions: [...readyQuestions, ...rest] }),
    });
    repository.completeDraft.mockResolvedValue(false);
    repository.findByTokenHash
      .mockResolvedValueOnce(record(stored(2)))
      .mockResolvedValueOnce(record({ status: 'ready', title: 'Cells', questionCount: 4 }));

    expect(await service.status(TOKEN, IP)).toMatchObject({
      ok: true,
      draft: { questionCount: 4, complete: true },
    });
    expect(events.ready).not.toHaveBeenCalled();
  });

  it('carries the API completion first_batch_only onto the record', async () => {
    const { service, repository, upstream } = setup(record(stored(2)));
    upstream.get.mockResolvedValue({
      ok: true,
      draft: upstreamDraft({
        status: 'completed',
        completion: 'first_batch_only',
        questions: readyQuestions,
      }),
    });

    expect(await service.status(TOKEN, IP)).toMatchObject({
      ok: true,
      draft: { questionCount: 2, complete: true, completion: 'first_batch_only' },
    });
    expect(repository.completeDraft).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ questions: [], completion: 'first_batch_only' }),
    );
  });

  it.each([
    [
      'failed',
      {
        ok: true as const,
        draft: upstreamDraft({ status: 'failed', failure_reason: 'extract_failed' }),
      },
    ],
    ['cancelled', { ok: true as const, draft: upstreamDraft({ status: 'cancelled' }) }],
    ['expired', { ok: true as const, draft: upstreamDraft({ status: 'expired' }) }],
    ['404', { ok: false as const, status: 404, code: 'not_found', meta: null }],
  ])(
    'an upstream %s after the first batch keeps it: complete, no refund, no failed event',
    async (_, answer) => {
      const { service, repository, upstream, limiter, events } = setup(record(stored(2)));
      upstream.get.mockResolvedValue(answer);

      const result = await service.status(TOKEN, IP);

      expect(result).toEqual({
        ok: true,
        draft: {
          status: 'ready',
          progressPercent: 100,
          title: 'Quiz 11/10/2026',
          questionCount: 2,
          complete: true,
          completion: 'first_batch_only',
          failureReason: null,
        },
      });
      expect(repository.completeDraft).toHaveBeenCalledWith('6730a0000000000000000001', {
        storedCount: 2,
        questions: [],
        completion: 'first_batch_only',
      });
      expect(upstream.remove).toHaveBeenCalledWith('api-draft-1');
      expect(repository.markFailed).not.toHaveBeenCalled();
      expect(limiter.refundIp).not.toHaveBeenCalled();
      expect(events.failed).not.toHaveBeenCalled();
      expect(events.ready).not.toHaveBeenCalled();
    },
  );

  it('a direct completion with no partial step is one ready draft with both events', async () => {
    const { service, repository, upstream, events } = setup(record());
    upstream.get.mockResolvedValue({
      ok: true,
      draft: upstreamDraft({ status: 'completed', title: 'Cells', questions: readyQuestions }),
    });

    expect(await service.status(TOKEN, IP)).toMatchObject({
      ok: true,
      draft: { status: 'ready', complete: true, completion: 'full' },
    });
    expect(repository.storeFirstBatch).not.toHaveBeenCalled();
    expect(repository.completeDraft).not.toHaveBeenCalled();
    expect(events.firstBatchReady).toHaveBeenCalledExactlyOnceWith(context, 8000);
    expect(events.ready).toHaveBeenCalledOnce();
    expect(events.firstBatchReady.mock.invocationCallOrder[0]).toBeLessThan(
      events.ready.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('a direct first_batch_only completion stores that completion', async () => {
    const { service, repository, upstream } = setup(record());
    upstream.get.mockResolvedValue({
      ok: true,
      draft: upstreamDraft({
        status: 'completed',
        completion: 'first_batch_only',
        questions: readyQuestions,
      }),
    });

    expect(await service.status(TOKEN, IP)).toMatchObject({
      ok: true,
      draft: { completion: 'first_batch_only' },
    });
    expect(repository.markReady).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ completion: 'first_batch_only' }),
    );
  });

  it('refreshHashed polls by hash; releaseUpstream deletes the API draft', async () => {
    const { service, repository, upstream } = setup(record(stored(2)));
    upstream.get.mockResolvedValue({
      ok: true,
      draft: upstreamDraft({ status: 'completed', questions: [...readyQuestions, ...rest] }),
    });

    await service.refreshHashed('f'.repeat(64));
    expect(repository.findByTokenHash).toHaveBeenCalledWith('f'.repeat(64));
    expect(repository.completeDraft).toHaveBeenCalledOnce();

    await service.releaseUpstream('api-draft-9');
    expect(upstream.remove).toHaveBeenLastCalledWith('api-draft-9');
  });
});
