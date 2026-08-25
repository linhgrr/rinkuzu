import { beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';
import type { Quiz } from '@/entities/Quiz';
import type { PremiumPlaySession, PremiumQuizSubmission } from '@/entities/PremiumQuiz';
import type { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import type { IPremiumQuizRepository } from '@/interfaces/repositories/IPremiumQuizRepository';
import type { IQuizAttemptProgressRepository } from '@/interfaces/repositories/IQuizAttemptProgressRepository';
import { PremiumQuizError } from '@/entities/PremiumQuizError';
import { PremiumQuizService } from '@/services/premium/PremiumQuizService';

const entitlementMocks = vi.hoisted(() => ({
  resolveEntitlements: vi.fn(),
}));

vi.mock('@/lib/entitlements', () => ({
  resolveEntitlements: entitlementMocks.resolveEntitlements,
  can: (entitlements: { tier: string }) => entitlements.tier === 'premium',
}));

const now = new Date('2026-08-24T00:00:00.000Z');

function quiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: '507f191e810c19729de860ea',
    title: 'Curated algebra',
    slug: 'curated-algebra',
    author: { id: '507f191e810c19729de860eb' },
    visibility: 'personal',
    questions: Array.from({ length: 7 }, (_, index) => ({
      id: `507f191e810c19729de86${String(index).padStart(2, '0')}`,
      type: 'single' as const,
      question: `Question ${index + 1}`,
      options: ['A', 'B'],
      correctIndex: index % 2,
    })),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function publication(source = quiz()): PremiumQuizSubmission {
  return {
    id: '507f191e810c19729de860ec',
    sourceQuizId: source.id,
    authorId: '507f191e810c19729de860eb',
    version: 1,
    status: 'approved',
    sourceType: 'manual',
    rightsAttested: true,
    snapshot: {
      title: source.title,
      slug: source.slug,
      questions: source.questions,
    },
    snapshotHash: 'a'.repeat(64),
    questionHashes: source.questions.map((_, index) => String(index).padStart(64, '0')),
    duplicateReport: {
      exactDocumentRewarded: false,
      exactQuiz: false,
      sharedQuestionCount: 0,
      highestSimilarity: 0,
      matches: [],
    },
    reviewStatus: 'completed',
    reviewSnapshotHash: 'a'.repeat(64),
    awardedCredits: 3,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
}

function playSession(): PremiumPlaySession {
  return {
    id: '507f191e810c19729de860ed',
    userId: '507f191e810c19729de860ee',
    quizId: '507f191e810c19729de860ea',
    submissionId: '507f191e810c19729de860ec',
    snapshotHash: 'a'.repeat(64),
    answers: [],
    currentQuestionIndex: 0,
    highestBatch: 0,
    sessionCode: 'TRACE123',
    idleExpiresAt: new Date('2099-08-24T02:00:00.000Z'),
    absoluteExpiresAt: new Date('2099-08-25T00:00:00.000Z'),
    createdAt: now,
    updatedAt: now,
  };
}

function setup() {
  const quizRepository: Mocked<IQuizRepository> = {
    findById: vi.fn(),
    findAccessById: vi.fn(),
    findBySlug: vi.fn(),
    findSummaryBySlug: vi.fn(),
    findIdBySlug: vi.fn(),
    findBySourceDraftId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findAll: vi.fn(),
    findForPlay: vi.fn(),
    findUserQuizzes: vi.fn(),
    findPublicByAuthor: vi.fn(),
    count: vi.fn(),
    countByCreatedAtBuckets: vi.fn(),
    findTopCreators: vi.fn(),
  };
  const premiumRepository: Mocked<IPremiumQuizRepository> = {
    isVerifiedUser: vi.fn(),
    createSubmission: vi.fn(),
    findSubmissionById: vi.fn(),
    findDuplicateCandidates: vi.fn(),
    listMine: vi.fn(),
    listAdmin: vi.fn(),
    listCatalog: vi.fn(),
    decide: vi.fn(),
    beginReview: vi.fn(),
    updateReview: vi.fn(),
    getWalletAndLedger: vi.fn(),
    grantAdminCredits: vi.fn(),
    unlock: vi.fn(),
    hasGrant: vi.fn(),
    findActivePublicationByQuizId: vi.fn(),
    findActivePublicationBySlug: vi.fn(),
    createSession: vi.fn(),
    findSession: vi.fn(),
    consumeBatchQuota: vi.fn(),
    updateProgress: vi.fn(),
    claimSessionSubmission: vi.fn(),
    completeSession: vi.fn(),
  };
  const attemptRepository: Mocked<IQuizAttemptProgressRepository> = {
    recordSubmittedAttempt: vi.fn(),
  };
  return {
    service: new PremiumQuizService(quizRepository, premiumRepository, attemptRepository),
    quizRepository,
    premiumRepository,
    attemptRepository,
  };
}

describe('PremiumQuizService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    entitlementMocks.resolveEntitlements.mockResolvedValue({ tier: 'free' });
  });

  it('returns only the repository-projected Premium catalog metadata', async () => {
    const { service, premiumRepository } = setup();
    const catalog = {
      items: [
        {
          quizId: '507f191e810c19729de860ea',
          title: 'Curated algebra',
          slug: 'curated-algebra',
          description: 'Reviewed practice',
          questionCount: 7,
        },
      ],
      page: 1,
      limit: 12,
      totalItems: 1,
      totalPages: 1,
    };
    premiumRepository.listCatalog.mockResolvedValue(catalog);

    await expect(service.listCatalog({ search: 'algebra', page: 1, limit: 12 })).resolves.toEqual(
      catalog,
    );
    expect(premiumRepository.listCatalog).toHaveBeenCalledWith({
      search: 'algebra',
      page: 1,
      limit: 12,
    });
  });

  it('trims the reason and delegates an idempotent admin credit grant', async () => {
    const { service, premiumRepository } = setup();
    const result = {
      userId: '507f191e810c19729de860ee',
      amount: 5,
      balance: 12,
      ledgerEntryId: '507f191e810c19729de860ef',
      alreadyApplied: false,
    };
    premiumRepository.grantAdminCredits.mockResolvedValue(result);

    await expect(
      service.grantAdminCredits({
        userId: result.userId,
        adminUserId: '507f191e810c19729de860eb',
        amount: 5,
        note: '  Verified contribution  ',
        idempotencyKey: '0aa7c561-a366-4abf-81ec-fb90e64c237c',
      }),
    ).resolves.toEqual(result);
    expect(premiumRepository.grantAdminCredits).toHaveBeenCalledWith({
      userId: result.userId,
      adminUserId: '507f191e810c19729de860eb',
      amount: 5,
      note: 'Verified contribution',
      idempotencyKey: '0aa7c561-a366-4abf-81ec-fb90e64c237c',
    });
  });

  it('requires verified email before reading or snapshotting the source quiz', async () => {
    const { service, premiumRepository, quizRepository } = setup();
    premiumRepository.isVerifiedUser.mockResolvedValue(false);

    await expect(
      service.createSubmission('507f191e810c19729de860eb', {
        quizId: '507f191e810c19729de860ea',
        rightsAttested: true,
      }),
    ).rejects.toMatchObject({
      code: 'email_verification_required',
    } satisfies Partial<PremiumQuizError>);
    expect(quizRepository.findById).not.toHaveBeenCalled();
  });

  it('enforces the owner/admin/Premium/permanent-grant access matrix', async () => {
    const { service, premiumRepository } = setup();
    const quizId = '507f191e810c19729de860ea';

    await expect(
      service.canAccess({ userId: '507f191e810c19729de860eb' }, quizId, '507f191e810c19729de860eb'),
    ).resolves.toBe(true);
    await expect(
      service.canAccess({ userId: '507f191e810c19729de860ef', role: 'admin' }, quizId),
    ).resolves.toBe(true);
    expect(entitlementMocks.resolveEntitlements).not.toHaveBeenCalled();
    expect(premiumRepository.hasGrant).not.toHaveBeenCalled();

    entitlementMocks.resolveEntitlements.mockResolvedValueOnce({ tier: 'premium' });
    await expect(service.canAccess({ userId: 'premium-user' }, quizId)).resolves.toBe(true);
    expect(premiumRepository.hasGrant).not.toHaveBeenCalled();

    entitlementMocks.resolveEntitlements.mockResolvedValueOnce({ tier: 'free' });
    premiumRepository.hasGrant.mockResolvedValueOnce(true);
    await expect(service.canAccess({ userId: 'free-user' }, quizId)).resolves.toBe(true);
    expect(premiumRepository.hasGrant).toHaveBeenCalledWith('free-user', quizId);
  });

  it('denies unpublished Premium content before checking entitlements or grants', async () => {
    const { service, premiumRepository } = setup();
    premiumRepository.findActivePublicationByQuizId.mockResolvedValue(null);

    await expect(
      service.canAccessPublishedQuiz(
        { userId: '507f191e810c19729de860ee' },
        '507f191e810c19729de860ea',
      ),
    ).resolves.toBe(false);
    expect(entitlementMocks.resolveEntitlements).not.toHaveBeenCalled();
    expect(premiumRepository.hasGrant).not.toHaveBeenCalled();
  });

  it('passes the client idempotency key unchanged to the transactional credit unlock', async () => {
    const { service, premiumRepository } = setup();
    premiumRepository.unlock.mockResolvedValue({
      granted: true,
      alreadyGranted: false,
      balance: 2,
    });

    await expect(
      service.unlock(
        '507f191e810c19729de860ee',
        '507f191e810c19729de860ea',
        '018f7494-8bd8-7b8a-a387-3bc5a14f22a1',
      ),
    ).resolves.toEqual({ granted: true, alreadyGranted: false, balance: 2 });
    expect(premiumRepository.unlock).toHaveBeenCalledWith({
      userId: '507f191e810c19729de860ee',
      quizId: '507f191e810c19729de860ea',
      idempotencyKey: '018f7494-8bd8-7b8a-a387-3bc5a14f22a1',
    });
  });

  it('dispatches AI review only for a reviewable immutable snapshot', async () => {
    const { service, premiumRepository } = setup();
    const pending = { ...publication(), status: 'pending' as const, active: false };
    premiumRepository.findSubmissionById.mockResolvedValue(pending);
    premiumRepository.beginReview.mockResolvedValue({
      id: '507f191e810c19729de860f1',
      submissionId: pending.id,
      snapshotHash: pending.snapshotHash,
      status: 'queued',
    });

    const dispatch = await service.createReviewDispatch('507f191e810c19729de860ef', pending.id);
    expect(dispatch.snapshotHash).toBe(pending.snapshotHash);
    expect(dispatch.snapshot).toEqual(pending.snapshot);
    expect(premiumRepository.beginReview).toHaveBeenCalledWith({
      submissionId: pending.id,
      requestedBy: '507f191e810c19729de860ef',
      snapshotHash: pending.snapshotHash,
    });

    premiumRepository.findSubmissionById.mockResolvedValue(publication());
    await expect(
      service.createReviewDispatch('507f191e810c19729de860ef', pending.id),
    ).rejects.toMatchObject({ code: 'invalid_state' } satisfies Partial<PremiumQuizError>);
  });

  it('derives source type from trusted server evidence and flags a rewarded PDF duplicate', async () => {
    const { service, premiumRepository, quizRepository } = setup();
    const source = quiz();
    const rewarded = {
      ...publication(source),
      id: '507f191e810c19729de860ef',
      documentFingerprint: 'b'.repeat(64),
      awardedCredits: 4,
    };
    premiumRepository.isVerifiedUser.mockResolvedValue(true);
    quizRepository.findById.mockResolvedValue(source);
    premiumRepository.findDuplicateCandidates.mockResolvedValue([rewarded]);
    premiumRepository.createSubmission.mockImplementation(async (data) => ({
      ...publication(source),
      sourceType: data.sourceType,
      duplicateReport: data.duplicateReport,
      ...(data.documentFingerprint ? { documentFingerprint: data.documentFingerprint } : {}),
      ...(data.sourceObjectKey ? { sourceObjectKey: data.sourceObjectKey } : {}),
    }));

    const result = await service.createSubmission('507f191e810c19729de860eb', {
      quizId: source.id,
      rightsAttested: true,
      documentFingerprint: 'b'.repeat(64),
      sourceObjectKey: 'uploads/premium_sources/draft/source.pdf',
    });

    expect(result.sourceType).toBe('pdf');
    expect(result.duplicateReport.exactDocumentRewarded).toBe(true);
    expect(premiumRepository.createSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'pdf',
        sourceObjectKey: 'uploads/premium_sources/draft/source.pdf',
      }),
    );
  });

  it('delivers at most three questions without answer keys and binds cursors to the user', async () => {
    const { service, premiumRepository } = setup();
    const approved = publication();
    const session = playSession();
    premiumRepository.findActivePublicationByQuizId.mockResolvedValue(approved);
    premiumRepository.hasGrant.mockResolvedValue(true);
    premiumRepository.createSession.mockResolvedValue(session);
    premiumRepository.findSession.mockResolvedValue(session);
    premiumRepository.consumeBatchQuota.mockResolvedValue(true);
    premiumRepository.findSubmissionById.mockResolvedValue(approved);

    const first = await service.startSession({ userId: session.userId }, approved.sourceQuizId);
    expect(first.questions).toHaveLength(3);
    expect(first.questions[0]).not.toHaveProperty('correctIndex');
    expect(first.questions[0]).not.toHaveProperty('correctIndexes');
    expect(first.nextCursor).toBeTypeOf('string');

    await expect(
      service.getBatch({ userId: '507f191e810c19729de860ff' }, session.id, first.nextCursor ?? ''),
    ).rejects.toMatchObject({ code: 'invalid_cursor' } satisfies Partial<PremiumQuizError>);

    const second = await service.getBatch(
      { userId: session.userId },
      session.id,
      first.nextCursor ?? '',
    );
    expect(second.batchIndex).toBe(1);
    expect(second.questions).toHaveLength(3);
  });

  it('authorizes attempt history only against its immutable publication id and hash', async () => {
    const { service, premiumRepository } = setup();
    const approved = publication();
    premiumRepository.findSubmissionById.mockResolvedValue(approved);
    premiumRepository.hasGrant.mockResolvedValue(true);

    await expect(
      service.canAccessAttempt(
        { userId: '507f191e810c19729de860ee' },
        approved.sourceQuizId,
        approved.id,
        approved.snapshotHash,
      ),
    ).resolves.toBe(true);
    await expect(
      service.canAccessAttempt(
        { userId: '507f191e810c19729de860ee' },
        approved.sourceQuizId,
        approved.id,
        'f'.repeat(64),
      ),
    ).resolves.toBe(false);
    expect(premiumRepository.hasGrant).toHaveBeenCalledTimes(1);
  });

  it('returns one Premium flashcard and withholds its answer until reveal', async () => {
    const { service, premiumRepository } = setup();
    const approved = publication();
    const session = playSession();
    premiumRepository.findActivePublicationByQuizId.mockResolvedValue(approved);
    premiumRepository.hasGrant.mockResolvedValue(true);
    premiumRepository.createSession.mockResolvedValue(session);
    premiumRepository.findSession.mockResolvedValue(session);
    premiumRepository.findSubmissionById.mockResolvedValue(approved);
    premiumRepository.consumeBatchQuota.mockResolvedValue(true);

    const front = await service.startFlashcardSession(
      { userId: session.userId },
      approved.sourceQuizId,
    );
    expect(front.question.question).toBe('Question 1');
    expect(front.question).not.toHaveProperty('correctIndex');
    expect(front).toHaveProperty('revealCursor');

    const revealed = await service.revealFlashcard(session.userId, session.id, front.revealCursor);
    expect(revealed).toEqual({ questionIndex: 0, type: 'single', correctIndex: 0 });

    const next = await service.getFlashcard(session.userId, session.id, front.nextCursor ?? '');
    expect(next.questionIndex).toBe(1);
    expect(next.question.question).toBe('Question 2');
  });

  it('records an immutable publication id/hash and reuses the attempt idempotency key', async () => {
    const { service, premiumRepository, attemptRepository } = setup();
    const approved = publication({ ...quiz(), questions: quiz().questions.slice(0, 2) });
    const session = { ...playSession(), answers: [0, 0] };
    premiumRepository.findSession.mockResolvedValue(session);
    premiumRepository.claimSessionSubmission.mockResolvedValue('claimed');
    premiumRepository.findSubmissionById.mockResolvedValue(approved);
    premiumRepository.completeSession.mockResolvedValue({ ...session, completedAt: now });
    attemptRepository.recordSubmittedAttempt.mockResolvedValue({
      id: '507f191e810c19729de860f0',
      score: 50,
      correctAnswers: 1,
      totalQuestions: 2,
    });

    const result = await service.submitSession(
      session.userId,
      session.id,
      '018f7494-8bd8-7b8a-a387-3bc5a14f22a1',
    );

    expect(result.attemptId).toBe('507f191e810c19729de860f0');
    expect(attemptRepository.recordSubmittedAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        premiumSubmissionId: approved.id,
        premiumSnapshotHash: approved.snapshotHash,
        idempotencyKey: '018f7494-8bd8-7b8a-a387-3bc5a14f22a1',
      }),
    );
  });
});
