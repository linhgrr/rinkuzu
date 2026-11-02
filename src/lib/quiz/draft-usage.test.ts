import { beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory stand-in for the usage ledger: committed job-linked records, and
// the same "settle once" guard the Mongo implementation enforces with a
// conditional status update.
const ledger = vi.hoisted(() => {
  type Row = {
    userId: string;
    requestId: string;
    jobId: string;
    jobAttempt: number;
    status: 'committed' | 'refunded';
    jobOutcome?: string;
  };
  const rows: Row[] = [];
  return {
    rows,
    listUnsettledLlmJobUsage: vi.fn(async (userId: string) =>
      rows
        .filter((row) => row.userId === userId && row.status === 'committed' && !row.jobOutcome)
        .map(({ requestId, jobId, jobAttempt }) => ({ requestId, jobId, jobAttempt })),
    ),
    refundLlmJobUsage: vi.fn(
      async (userId: string, _action: string, requestId: string, outcome: string) => {
        const row = rows.find(
          (item) =>
            item.userId === userId &&
            item.requestId === requestId &&
            item.status === 'committed' &&
            !item.jobOutcome,
        );
        if (!row) return false;
        row.status = 'refunded';
        row.jobOutcome = outcome;
        return true;
      },
    ),
    settleLlmJobUsageOutcome: vi.fn(
      async (userId: string, _action: string, requestId: string, outcome: string) => {
        const row = rows.find(
          (item) =>
            item.userId === userId && item.requestId === requestId && item.status === 'committed',
        );
        if (row && !row.jobOutcome) row.jobOutcome = outcome;
      },
    ),
  };
});

const proxyMock = vi.hoisted(() => vi.fn());
const loggerWarn = vi.hoisted(() => vi.fn());

vi.mock('@/lib/llm/job-usage', () => ({
  listUnsettledLlmJobUsage: ledger.listUnsettledLlmJobUsage,
  refundLlmJobUsage: ledger.refundLlmJobUsage,
  settleLlmJobUsageOutcome: ledger.settleLlmJobUsageOutcome,
}));
vi.mock('@/lib/adaptive/proxy', () => ({ proxyAdaptiveRequest: proxyMock }));
vi.mock('@/lib/logger', () => ({ logger: { warn: loggerWarn, error: vi.fn() } }));

import {
  quizDraftJobLinkFromEnvelope,
  reconcileQuizDraftUsage,
  settleQuizDraftUsageBeforeDelete,
  settleQuizDraftUsageFromResponse,
} from './draft-usage';

const learner = { userId: 'learner-1', userRole: 'user' as const };

function charge(requestId: string, draftId: string) {
  ledger.rows.push({
    userId: learner.userId,
    requestId,
    jobId: draftId,
    jobAttempt: 0,
    status: 'committed',
  });
}

function draft(draftId: string, status: string) {
  return { draft_id: draftId, status, title: 'Biology notes', source_type: 'pdf' };
}

function listResponse(...drafts: ReturnType<typeof draft>[]) {
  return Response.json({ success: true, data: { drafts } });
}

function singleResponse(item: ReturnType<typeof draft>) {
  return Response.json({ success: true, data: { draft: item } });
}

function notFound() {
  return Response.json({ success: false, error: { code: 'not_found' } }, { status: 404 });
}

function outcomes() {
  return ledger.rows.map((row) => [row.requestId, row.status, row.jobOutcome]);
}

describe('quiz draft usage settlement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    proxyMock.mockReset();
    ledger.rows.length = 0;
  });

  it('refunds the unit once when extraction fails, across repeated reads', async () => {
    charge('extract-1', 'draft-1');

    await settleQuizDraftUsageFromResponse(listResponse(draft('draft-1', 'failed')), learner);
    await settleQuizDraftUsageFromResponse(listResponse(draft('draft-1', 'failed')), learner);
    await settleQuizDraftUsageFromResponse(singleResponse(draft('draft-1', 'failed')), learner);

    expect(ledger.refundLlmJobUsage).toHaveBeenCalledOnce();
    expect(ledger.refundLlmJobUsage).toHaveBeenCalledWith(
      'learner-1',
      'quiz_extract',
      'extract-1',
      'failed',
    );
    expect(ledger.rows[0]).toMatchObject({ status: 'refunded', jobOutcome: 'failed' });
  });

  it('keeps the charge for drafts that produced questions and stops tracking them', async () => {
    charge('extract-2', 'draft-2');
    charge('extract-3', 'draft-3');

    await settleQuizDraftUsageFromResponse(
      listResponse(draft('draft-2', 'completed'), draft('draft-3', 'submitted')),
      learner,
    );
    await settleQuizDraftUsageFromResponse(listResponse(draft('draft-2', 'completed')), learner);

    expect(ledger.refundLlmJobUsage).not.toHaveBeenCalled();
    expect(ledger.settleLlmJobUsageOutcome).toHaveBeenCalledTimes(2);
    expect(outcomes()).toEqual([
      ['extract-2', 'committed', 'completed'],
      ['extract-3', 'committed', 'completed'],
    ]);
  });

  it('does not settle a draft that is still extracting', async () => {
    charge('extract-4', 'draft-4');
    charge('extract-5', 'draft-5');

    await settleQuizDraftUsageFromResponse(
      listResponse(draft('draft-4', 'queued'), draft('draft-5', 'processing')),
      learner,
    );

    expect(ledger.refundLlmJobUsage).not.toHaveBeenCalled();
    expect(ledger.settleLlmJobUsageOutcome).not.toHaveBeenCalled();
    expect(outcomes()).toEqual([
      ['extract-4', 'committed', undefined],
      ['extract-5', 'committed', undefined],
    ]);
  });

  it('keeps the charge for cancelled and expired drafts', async () => {
    charge('extract-6', 'draft-6');
    charge('extract-7', 'draft-7');

    await settleQuizDraftUsageFromResponse(
      listResponse(draft('draft-6', 'cancelled'), draft('draft-7', 'expired')),
      learner,
    );

    expect(ledger.refundLlmJobUsage).not.toHaveBeenCalled();
    expect(outcomes()).toEqual([
      ['extract-6', 'committed', 'cancelled'],
      ['extract-7', 'committed', 'missing'],
    ]);
  });

  it('does nothing for admins, error responses, unknown shapes, or other users', async () => {
    charge('extract-8', 'draft-8');

    await settleQuizDraftUsageFromResponse(listResponse(draft('draft-8', 'failed')), {
      userId: learner.userId,
      userRole: 'admin',
    });
    await settleQuizDraftUsageFromResponse(notFound(), learner);
    await settleQuizDraftUsageFromResponse(
      Response.json({ success: true, data: { draft: { status: 'failed' } } }),
      learner,
    );
    await settleQuizDraftUsageFromResponse(Response.json({ success: true, data: null }), learner);
    await settleQuizDraftUsageFromResponse(listResponse(draft('draft-8', 'failed')), {
      userId: 'someone-else',
      userRole: 'user',
    });

    expect(ledger.refundLlmJobUsage).not.toHaveBeenCalled();
    expect(ledger.rows[0]).toMatchObject({ status: 'committed' });
  });

  it('never fails the read when the ledger is unavailable', async () => {
    ledger.listUnsettledLlmJobUsage.mockRejectedValueOnce(new Error('db down'));
    const response = listResponse(draft('draft-9', 'failed'));

    await expect(settleQuizDraftUsageFromResponse(response, learner)).resolves.toBeUndefined();
    await expect(response.json()).resolves.toMatchObject({ success: true });
    expect(loggerWarn).toHaveBeenCalledOnce();
  });

  describe('settleQuizDraftUsageBeforeDelete', () => {
    it('refunds a failed draft that was never read before deletion', async () => {
      charge('extract-10', 'draft-10');
      proxyMock.mockResolvedValue(singleResponse(draft('draft-10', 'failed')));

      await settleQuizDraftUsageBeforeDelete('draft-10', learner);
      await settleQuizDraftUsageBeforeDelete('draft-10', learner);

      expect(proxyMock).toHaveBeenCalledOnce();
      expect(proxyMock).toHaveBeenCalledWith(
        expect.any(Request),
        '/quiz/drafts/draft-10',
        learner,
        expect.objectContaining({ method: 'GET' }),
      );
      expect(ledger.refundLlmJobUsage).toHaveBeenCalledOnce();
      expect(ledger.rows[0]).toMatchObject({ status: 'refunded', jobOutcome: 'failed' });
    });

    it('skips the lookup for drafts that carry no unsettled charge', async () => {
      charge('extract-11', 'draft-11');

      await settleQuizDraftUsageBeforeDelete('manual-draft', learner);
      await settleQuizDraftUsageBeforeDelete('draft-11', { ...learner, userRole: 'admin' });

      expect(proxyMock).not.toHaveBeenCalled();
    });

    it('keeps the charge when the API is unreachable, and never throws', async () => {
      charge('extract-12', 'draft-12');
      proxyMock.mockRejectedValueOnce(new Error('network'));
      proxyMock.mockResolvedValueOnce(new Response(null, { status: 503 }));

      await expect(settleQuizDraftUsageBeforeDelete('draft-12', learner)).resolves.toBeUndefined();
      await expect(settleQuizDraftUsageBeforeDelete('draft-12', learner)).resolves.toBeUndefined();

      expect(ledger.rows[0]).toMatchObject({ status: 'committed' });
      expect(ledger.rows[0]?.jobOutcome).toBeUndefined();
      expect(loggerWarn).toHaveBeenCalledOnce();
    });
  });

  describe('reconcileQuizDraftUsage (no reads needed)', () => {
    it('fetches each unsettled draft, refunds the failed one and leaves running ones', async () => {
      charge('extract-13', 'draft-13');
      charge('extract-14', 'draft-14');
      charge('extract-15', 'draft-15');
      const statuses: Record<string, string> = {
        'draft-13': 'failed',
        'draft-14': 'completed',
        'draft-15': 'processing',
      };
      proxyMock.mockImplementation(async (_req: Request, path: string) => {
        const id = path.split('/').pop() ?? '';
        return singleResponse(draft(id, statuses[id] ?? 'failed'));
      });

      await reconcileQuizDraftUsage(learner);
      await reconcileQuizDraftUsage(learner);

      // The second pass only re-checks the draft that is still processing.
      expect(proxyMock).toHaveBeenCalledTimes(4);
      expect(ledger.refundLlmJobUsage).toHaveBeenCalledOnce();
      expect(outcomes()).toEqual([
        ['extract-13', 'refunded', 'failed'],
        ['extract-14', 'committed', 'completed'],
        ['extract-15', 'committed', undefined],
      ]);
    });

    it('marks a draft the service no longer knows as settled without refunding it', async () => {
      charge('extract-16', 'draft-16');
      proxyMock.mockResolvedValue(notFound());

      await reconcileQuizDraftUsage(learner);

      expect(ledger.refundLlmJobUsage).not.toHaveBeenCalled();
      expect(ledger.rows[0]).toMatchObject({ status: 'committed', jobOutcome: 'missing' });
    });

    it('skips admins and swallows upstream errors', async () => {
      charge('extract-17', 'draft-17');
      await reconcileQuizDraftUsage({ userId: learner.userId, userRole: 'admin' });
      expect(proxyMock).not.toHaveBeenCalled();

      proxyMock.mockRejectedValue(new Error('network'));
      await expect(reconcileQuizDraftUsage(learner)).resolves.toBeUndefined();
      expect(ledger.rows[0]).toMatchObject({ status: 'committed' });
    });
  });

  describe('quizDraftJobLinkFromEnvelope', () => {
    it('links the unit to the created draft', () => {
      expect(
        quizDraftJobLinkFromEnvelope({
          success: true,
          data: { draft: draft('draft-18', 'queued') },
        }),
      ).toEqual({ jobId: 'draft-18', jobAttempt: 0 });
    });

    it('returns null for anything that is not a created draft', () => {
      expect(quizDraftJobLinkFromEnvelope(null)).toBeNull();
      expect(quizDraftJobLinkFromEnvelope({ success: true, data: { draft: {} } })).toBeNull();
      expect(quizDraftJobLinkFromEnvelope({ success: false, error: {} })).toBeNull();
    });
  });
});
