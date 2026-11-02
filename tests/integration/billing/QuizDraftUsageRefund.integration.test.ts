import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';

import { integrationDatabaseUri } from '../../setup/integration-db';

const proxyMock = vi.hoisted(() => vi.fn());

// The suite owns the connection; the ledger's own connect helper is a no-op.
vi.mock('@/lib/mongoose', () => ({ default: async () => mongoose }));
vi.mock('@/lib/entitlements', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/entitlements')>()),
  resolveEntitlements: async () => ({ tier: 'free' as const }),
}));
// The FastAPI draft lookup is the only thing faked: the ledger is real.
vi.mock('@/lib/adaptive/proxy', () => ({ proxyAdaptiveRequest: proxyMock }));

import { commitLlmUsage, getLlmUsageSnapshot, reserveLlmUsage } from '@/lib/llm/rate-limit';
import {
  quizDraftJobLinkFromEnvelope,
  reconcileQuizDraftUsage,
  settleQuizDraftUsageBeforeDelete,
  settleQuizDraftUsageFromResponse,
} from '@/lib/quiz/draft-usage';

/**
 * RIN-596: a PDF quiz draft is charged when `POST /quiz/drafts` accepts it,
 * before extraction runs. These tests pin the whole settlement path against a
 * real replica set: a failed draft's unit comes back exactly once, a completed
 * one keeps its charge, and a running one is left alone.
 */
describe('quiz_extract draft-linked refunds', () => {
  const users: string[] = [];
  const free = { tier: 'free' as const };

  function nextUser(): { userId: string; userRole: 'user' } {
    const userId = `rin596-${randomUUID()}`;
    users.push(userId);
    return { userId, userRole: 'user' };
  }

  // The free tier allows one quiz_extract per minute; step the clock so each
  // upload lands in its own minute bucket of the same month.
  let minute = 0;
  function nextMinute(): void {
    minute += 1;
    vi.setSystemTime(new Date(Date.UTC(2026, 10, 12, 3, minute)));
  }

  function draftEnvelope(draftId: string, status: string) {
    return { success: true, data: { draft: { draft_id: draftId, status } } };
  }

  async function chargedDraft(userId: string, draftId: string) {
    nextMinute();
    const reservation = await reserveLlmUsage(userId, 'quiz_extract', randomUUID());
    expect(reservation.allowed).toBe(true);
    const link = quizDraftJobLinkFromEnvelope(draftEnvelope(draftId, 'queued'));
    expect(link).toEqual({ jobId: draftId, jobAttempt: 0 });
    await commitLlmUsage(reservation, link ?? undefined);
    return reservation;
  }

  async function monthUsed(userId: string): Promise<number> {
    const windows = await getLlmUsageSnapshot(userId, 'quiz_extract', free);
    return windows.find((window) => window.window === 'month')?.count ?? -1;
  }

  function listResponse(...drafts: Array<[string, string]>) {
    return Response.json({
      success: true,
      data: { drafts: drafts.map(([draft_id, status]) => ({ draft_id, status })) },
    });
  }

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      await mongoose.connect(integrationDatabaseUri(), { serverSelectionTimeoutMS: 2_000 });
    } catch (error) {
      throw new Error('Usage ledger integration database is unavailable', { cause: error });
    }
  }, 15_000);

  beforeEach(() => {
    proxyMock.mockReset();
  });

  afterAll(async () => {
    vi.useRealTimers();
    if (mongoose.connection.readyState !== 1) return;
    const db = mongoose.connection.db;
    await Promise.all([
      db?.collection('entitlement_usage_requests').deleteMany({ userId: { $in: users } }),
      db?.collection('entitlement_usage_buckets').deleteMany({ userId: { $in: users } }),
    ]);
    await mongoose.disconnect();
  }, 15_000);

  it('refunds a failed draft once, however often the list is read', async () => {
    const learner = nextUser();
    const reservation = await chargedDraft(learner.userId, 'draft-failed');
    expect(await monthUsed(learner.userId)).toBe(1);

    await settleQuizDraftUsageFromResponse(listResponse(['draft-failed', 'processing']), learner);
    expect(await monthUsed(learner.userId)).toBe(1);

    await Promise.all([
      settleQuizDraftUsageFromResponse(listResponse(['draft-failed', 'failed']), learner),
      settleQuizDraftUsageFromResponse(listResponse(['draft-failed', 'failed']), learner),
    ]);
    await settleQuizDraftUsageFromResponse(listResponse(['draft-failed', 'failed']), learner);

    expect(await monthUsed(learner.userId)).toBe(0);
    const record = await mongoose.connection.db
      ?.collection('entitlement_usage_requests')
      .findOne({ userId: learner.userId, requestId: reservation.requestId });
    expect(record).toMatchObject({
      status: 'refunded',
      jobOutcome: 'failed',
      jobId: 'draft-failed',
    });
  });

  it('keeps a completed draft charged exactly once', async () => {
    const learner = nextUser();
    await chargedDraft(learner.userId, 'draft-done');

    await settleQuizDraftUsageFromResponse(listResponse(['draft-done', 'completed']), learner);
    await settleQuizDraftUsageFromResponse(listResponse(['draft-done', 'failed']), learner);

    expect(await monthUsed(learner.userId)).toBe(1);
  });

  it('refunds a failed draft deleted before anyone read it', async () => {
    const learner = nextUser();
    await chargedDraft(learner.userId, 'draft-deleted');
    proxyMock.mockResolvedValue(Response.json(draftEnvelope('draft-deleted', 'failed')));

    await settleQuizDraftUsageBeforeDelete('draft-deleted', learner);

    expect(await monthUsed(learner.userId)).toBe(0);
  });

  it('frees quota for the next upload via the sweep, and keeps unproven drafts charged', async () => {
    const learner = nextUser();
    await chargedDraft(learner.userId, 'draft-a');
    await chargedDraft(learner.userId, 'draft-b');
    await chargedDraft(learner.userId, 'draft-c');
    const statuses: Record<string, string> = { 'draft-a': 'failed', 'draft-c': 'processing' };
    proxyMock.mockImplementation(async (_req: Request, path: string) => {
      const draftId = path.split('/').pop() ?? '';
      const status = statuses[draftId];
      return status
        ? Response.json(draftEnvelope(draftId, status))
        : Response.json({ success: false, error: { code: 'not_found' } }, { status: 404 });
    });

    await reconcileQuizDraftUsage(learner);
    await reconcileQuizDraftUsage(learner);

    // draft-a refunded; draft-b (404) and draft-c (processing) keep counting.
    expect(await monthUsed(learner.userId)).toBe(2);
  });
});
