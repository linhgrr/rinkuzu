import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PremiumQuizSubmission } from '@/entities/PremiumQuiz';
import type { NudgeLearner } from '@/repositories/ActivationNudgeRepository';

const AUTHOR_ID = '6a8ed209f04328ac17443d91';
const SUBMISSION_ID = '6a8ed209f04328ac17443d92';
const QUIZ_ID = '6a8ed209f04328ac17443d93';

const outbox = vi.hoisted(() => ({
  rows: new Map<string, Record<string, unknown>>(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/public-env', () => ({
  publicEnv: { NEXT_PUBLIC_SITE_URL: 'https://www.rinkuzu.app/' },
}));
vi.mock('./resend', () => ({
  communicationEnvironment: (name: string) =>
    name === 'SUPPORT_MAIL_FROM' ? 'RinKuzu <support@example.com>' : 'unused',
}));
vi.mock('@/repositories/ActivationNudgeRepository', () => ({
  ActivationNudgeRepository: class {},
}));
vi.mock('@/models/Communication', () => ({
  AdminActionAudit: {},
  EmailOutbox: {
    // The real upsert: insert once per dedupeKey, never overwrite.
    updateOne: vi.fn(
      async (filter: { dedupeKey: string }, update: { $setOnInsert: Record<string, unknown> }) => {
        if (outbox.rows.has(filter.dedupeKey)) return { upsertedCount: 0 };
        outbox.rows.set(filter.dedupeKey, update.$setOnInsert);
        return { upsertedCount: 1 };
      },
    ),
  },
}));

const { PremiumRejectMailNotifier } = await import('./premium-reject');
const premiumRejectDedupeKey = (id: string) => `premium-reject:${id}`;

function author(overrides: Partial<NudgeLearner> = {}): NudgeLearner {
  return {
    id: new Types.ObjectId(AUTHOR_ID),
    email: 'author@example.com',
    name: 'Fake Author',
    role: 'user',
    disable: 0,
    isTestAccount: false,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    locale: 'en',
    ...overrides,
  };
}

function submission(overrides: Partial<PremiumQuizSubmission> = {}): PremiumQuizSubmission {
  return {
    id: SUBMISSION_ID,
    sourceQuizId: QUIZ_ID,
    authorId: AUTHOR_ID,
    version: 1,
    status: 'rejected',
    sourceType: 'manual',
    rightsAttested: true,
    snapshot: { title: 'Cell biology', slug: 'cell-biology', questions: [] },
    snapshotHash: 'a'.repeat(64),
    questionHashes: [],
    duplicateReport: {
      exactDocumentRewarded: false,
      exactQuiz: false,
      sharedQuestionCount: 0,
      highestSimilarity: 0,
      matches: [],
    },
    reviewStatus: 'completed',
    reviewerNote: 'Too close to the textbook.',
    awardedCredits: 0,
    active: false,
    createdAt: new Date('2026-11-09T00:00:00.000Z'),
    updatedAt: new Date('2026-11-09T00:00:00.000Z'),
    ...overrides,
  };
}

function notifier(found: NudgeLearner | null) {
  const findLearner = vi.fn(async (_userId: Types.ObjectId) => found);
  return {
    findLearner,
    service: new PremiumRejectMailNotifier({ findLearner }),
  };
}

describe('PremiumRejectMailNotifier (RIN-1348)', () => {
  beforeEach(() => outbox.rows.clear());

  it('queues one email to the author in their locale with the note and the public line', async () => {
    const { service, findLearner } = notifier(author({ locale: 'en' }));

    await service.queueRejectEmail({ submission: submission(), quizMadePublic: true });

    expect(findLearner).toHaveBeenCalledWith(new Types.ObjectId(AUTHOR_ID));
    const row = outbox.rows.get(`premium-reject:${SUBMISSION_ID}`);
    expect(row).toMatchObject({
      kind: 'premium_decision',
      entityType: 'premium_submission',
      to: 'author@example.com',
      from: 'RinKuzu <support@example.com>',
      subject: 'Your quiz “Cell biology” was not accepted into Premium',
    });
    expect(String(row?.['entityId'])).toBe(SUBMISSION_ID);
    expect(String(row?.['userId'])).toBe(AUTHOR_ID);
    expect(row?.['text']).toContain('Too close to the textbook.');
    expect(row?.['text']).toContain('It is now public');
    expect(row?.['html']).toContain(`https://www.rinkuzu.app/en/edit/${QUIZ_ID}`);
  });

  it('writes Vietnamese when the locale is unknown, without the public line when it stayed private', async () => {
    const { service } = notifier(author({ locale: null }));

    await service.queueRejectEmail({
      submission: submission({ reviewerNote: '' }),
      quizMadePublic: false,
    });

    const row = outbox.rows.get(premiumRejectDedupeKey(SUBMISSION_ID));
    expect(row?.['subject']).toBe('Bài quiz “Cell biology” chưa được nhận vào Premium');
    expect(row?.['text']).not.toContain('đã công khai');
    expect(row?.['text']).not.toContain('Ghi chú của người duyệt');
    expect(row?.['html']).toContain(`https://www.rinkuzu.app/vi/edit/${QUIZ_ID}`);
  });

  it('keeps the first email on a retry of the same reject', async () => {
    const { service } = notifier(author());

    await service.queueRejectEmail({ submission: submission(), quizMadePublic: true });
    await service.queueRejectEmail({ submission: submission(), quizMadePublic: false });

    expect(outbox.rows.size).toBe(1);
    expect(outbox.rows.get(premiumRejectDedupeKey(SUBMISSION_ID))?.['text']).toContain(
      'It is now public',
    );
  });

  it.each([
    ['a deleted', null],
    ['a disabled', author({ disable: 1 })],
  ])('queues nothing for %s account', async (_label, found) => {
    const { service } = notifier(found);

    await service.queueRejectEmail({ submission: submission(), quizMadePublic: true });

    expect(outbox.rows.size).toBe(0);
  });
});
