import { beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';
import type { Quiz } from '@/entities/Quiz';
import type { PremiumPlaySession, PremiumQuizSubmission } from '@/entities/PremiumQuiz';
import type { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import type {
  IPremiumQuizRepository,
  IPremiumSubmissionRecoveryRepository,
} from '@/interfaces/repositories/IPremiumQuizRepository';
import type { IQuizAttemptProgressRepository } from '@/interfaces/repositories/IQuizAttemptProgressRepository';
import { PremiumQuizError, PremiumSubmissionFailedError } from '@/entities/PremiumQuizError';
import { PremiumQuizService } from '@/services/premium/PremiumQuizService';
import type { IPremiumDecisionNotifier } from '@/interfaces/services/IPremiumDecisionNotifier';

const entitlementMocks = vi.hoisted(() => ({
  resolveEntitlements: vi.fn(),
}));

const loggerMocks = vi.hoisted(() => ({ warn: vi.fn() }));

vi.mock('@/lib/logger', () => ({
  logger: { warn: loggerMocks.warn, info: vi.fn(), error: vi.fn() },
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
    findCanonicalSlugByAlias: vi.fn(),
    findBySourceDraftId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findAll: vi.fn(),
    findForPlay: vi.fn(),
    findUserQuizzes: vi.fn(),
    findPublicByAuthor: vi.fn(),
    findMetadataBySlug: vi.fn(),
    findNonIndexableOwnerCandidates: vi.fn(),
    findPublicSitemapEntries: vi.fn(),
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
    findGrantedQuizIds: vi.fn(),
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
  const notifier: Mocked<IPremiumDecisionNotifier> = { queueRejectEmail: vi.fn() };
  return {
    service: new PremiumQuizService(
      quizRepository,
      premiumRepository,
      attemptRepository,
      undefined,
      notifier,
    ),
    notifier,
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

  it('marks the catalog items a signed-in learner already unlocked with credit (RIN-1014)', async () => {
    const { service, premiumRepository } = setup();
    const owned = '507f191e810c19729de860ea';
    const other = '507f191e810c19729de860eb';
    premiumRepository.listCatalog.mockResolvedValue({
      items: [
        { quizId: owned, title: 'Owned', slug: 'owned', questionCount: 3 },
        { quizId: other, title: 'Other', slug: 'other', questionCount: 4 },
      ],
      page: 1,
      limit: 12,
      totalItems: 2,
      totalPages: 1,
    });
    premiumRepository.findGrantedQuizIds.mockResolvedValue([owned]);

    const result = await service.listCatalog({ page: 1, limit: 12 }, 'learner-1');

    expect(premiumRepository.findGrantedQuizIds).toHaveBeenCalledWith('learner-1', [owned, other]);
    expect(result.items.map((item) => [item.quizId, item.unlocked])).toEqual([
      [owned, true],
      [other, false],
    ]);
  });

  it('skips the grant lookup for anonymous visitors and empty pages', async () => {
    const { service, premiumRepository } = setup();
    premiumRepository.listCatalog.mockResolvedValue({
      items: [],
      page: 1,
      limit: 12,
      totalItems: 0,
      totalPages: 0,
    });

    await service.listCatalog({ page: 1, limit: 12 }, 'learner-1');
    await service.listCatalog({ page: 1, limit: 12 }, null);

    expect(premiumRepository.findGrantedQuizIds).not.toHaveBeenCalled();
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

  it('refuses to start a locked quiz with unlock_required, not a bare forbidden (RIN-753)', async () => {
    const { service, premiumRepository } = setup();
    const approved = publication();
    premiumRepository.findActivePublicationByQuizId.mockResolvedValue(approved);
    entitlementMocks.resolveEntitlements.mockResolvedValue({ tier: 'free' });
    premiumRepository.hasGrant.mockResolvedValue(false);

    await expect(
      service.startSession({ userId: '507f191e810c19729de860ff' }, approved.sourceQuizId),
    ).rejects.toMatchObject({ code: 'unlock_required' } satisfies Partial<PremiumQuizError>);
    await expect(
      service.startFlashcardSession({ userId: '507f191e810c19729de860ff' }, approved.sourceQuizId),
    ).rejects.toMatchObject({ code: 'unlock_required' } satisfies Partial<PremiumQuizError>);
    expect(premiumRepository.createSession).not.toHaveBeenCalled();
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

  describe("decide: the author's reject email (RIN-1348)", () => {
    const decided = (status: PremiumQuizSubmission['status']) => ({
      submission: { ...publication(), status, reviewerNote: 'Too close to the textbook.' },
      awardedCredits: 0,
      rewardLocked: false,
      quizMadePublic: true,
    });

    it('queues the email after a reject with whether the quiz went public', async () => {
      const { service, premiumRepository, notifier } = setup();
      const result = decided('rejected');
      premiumRepository.decide.mockResolvedValue(result);

      await expect(
        service.decide('507f191e810c19729de860ef', result.submission.id, {
          decision: 'reject',
          credits: 0,
          note: 'Too close to the textbook.',
        }),
      ).resolves.toBe(result);

      expect(notifier.queueRejectEmail).toHaveBeenCalledTimes(1);
      expect(notifier.queueRejectEmail).toHaveBeenCalledWith({
        submission: result.submission,
        quizMadePublic: true,
      });
    });

    it.each([
      ['approve', 'approved'],
      ['request_changes', 'changes_requested'],
    ] as const)('queues nothing on %s', async (decision, status) => {
      const { service, premiumRepository, notifier } = setup();
      premiumRepository.decide.mockResolvedValue({ ...decided(status), quizMadePublic: false });

      await service.decide('507f191e810c19729de860ef', publication().id, {
        decision,
        credits: decision === 'approve' ? 3 : 0,
      });

      expect(notifier.queueRejectEmail).not.toHaveBeenCalled();
    });

    it('keeps the decision when the email cannot be queued, and logs it', async () => {
      const { service, premiumRepository, notifier } = setup();
      const result = decided('rejected');
      premiumRepository.decide.mockResolvedValue(result);
      notifier.queueRejectEmail.mockRejectedValue(new Error('outbox down'));

      await expect(
        service.decide('507f191e810c19729de860ef', result.submission.id, {
          decision: 'reject',
          credits: 0,
        }),
      ).resolves.toBe(result);

      expect(loggerMocks.warn).toHaveBeenCalledWith(
        expect.objectContaining({ submissionId: result.submission.id, errorName: 'Error' }),
        expect.any(String),
      );
    });

    it('queues nothing when the decision itself fails', async () => {
      const { service, premiumRepository, notifier } = setup();
      premiumRepository.decide.mockRejectedValue(new PremiumQuizError('conflict', 'changed'));

      await expect(
        service.decide('507f191e810c19729de860ef', publication().id, {
          decision: 'reject',
          credits: 0,
        }),
      ).rejects.toMatchObject({ code: 'conflict' });
      expect(notifier.queueRejectEmail).not.toHaveBeenCalled();
    });
  });
});

describe('PremiumQuizService.submitSavedQuiz (RIN-1347)', () => {
  const ownerId = '507f191e810c19729de860eb';

  function setupWithRecovery() {
    const base = setup();
    const recovery: Mocked<IPremiumSubmissionRecoveryRepository> = {
      restorePublicAfterFailedSubmission: vi.fn(),
    };
    const service = new PremiumQuizService(
      base.quizRepository,
      base.premiumRepository,
      base.attemptRepository,
      recovery,
    );
    const source = quiz();
    base.premiumRepository.isVerifiedUser.mockResolvedValue(true);
    base.quizRepository.findById.mockResolvedValue(source);
    base.premiumRepository.findDuplicateCandidates.mockResolvedValue([]);
    return { ...base, service, recovery, source };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the pending submission and leaves the quiz private on success', async () => {
    const { service, premiumRepository, recovery, source } = setupWithRecovery();
    premiumRepository.createSubmission.mockResolvedValue(publication(source));

    await expect(
      service.submitSavedQuiz(ownerId, { quizId: source.id, rightsAttested: true }),
    ).resolves.toMatchObject({ sourceQuizId: source.id });
    expect(recovery.restorePublicAfterFailedSubmission).not.toHaveBeenCalled();
  });

  it('sets the quiz back to public and reports premium_submission_failed', async () => {
    const { service, premiumRepository, recovery, source } = setupWithRecovery();
    premiumRepository.createSubmission.mockRejectedValue(new Error('db write failed'));
    recovery.restorePublicAfterFailedSubmission.mockResolvedValue(true);

    const error = await service
      .submitSavedQuiz(ownerId, { quizId: source.id, rightsAttested: true })
      .catch((caught: unknown) => caught);

    expect(recovery.restorePublicAfterFailedSubmission).toHaveBeenCalledWith(source.id);
    expect(error).toBeInstanceOf(PremiumSubmissionFailedError);
    expect(error).toMatchObject({
      code: 'premium_submission_failed',
      causeCode: null,
      quizId: source.id,
    });
  });

  it('keeps the Premium refusal as the cause', async () => {
    const { service, premiumRepository, recovery, source } = setupWithRecovery();
    premiumRepository.findDuplicateCandidates.mockRejectedValue(
      new PremiumQuizError('invalid_state', 'Premium quiz assets could not be secured'),
    );
    recovery.restorePublicAfterFailedSubmission.mockResolvedValue(true);

    await expect(
      service.submitSavedQuiz(ownerId, { quizId: source.id, rightsAttested: true }),
    ).rejects.toMatchObject({ code: 'premium_submission_failed', causeCode: 'invalid_state' });
  });

  it('rethrows the original error when an older submission keeps the quiz private', async () => {
    const { service, premiumRepository, recovery, source } = setupWithRecovery();
    const original = new Error('db write failed');
    premiumRepository.createSubmission.mockRejectedValue(original);
    recovery.restorePublicAfterFailedSubmission.mockResolvedValue(false);

    await expect(
      service.submitSavedQuiz(ownerId, { quizId: source.id, rightsAttested: true }),
    ).rejects.toBe(original);
  });

  it('rethrows the original error when the flip itself fails', async () => {
    const { service, premiumRepository, recovery, source } = setupWithRecovery();
    const original = new Error('db write failed');
    premiumRepository.createSubmission.mockRejectedValue(original);
    recovery.restorePublicAfterFailedSubmission.mockRejectedValue(new Error('still down'));

    await expect(
      service.submitSavedQuiz(ownerId, { quizId: source.id, rightsAttested: true }),
    ).rejects.toBe(original);
  });

  it('rethrows the original error when no recovery repository is wired', async () => {
    const { premiumRepository, quizRepository, attemptRepository, source } = setupWithRecovery();
    const service = new PremiumQuizService(quizRepository, premiumRepository, attemptRepository);
    const original = new Error('db write failed');
    premiumRepository.createSubmission.mockRejectedValue(original);

    await expect(
      service.submitSavedQuiz(ownerId, { quizId: source.id, rightsAttested: true }),
    ).rejects.toBe(original);
  });
});

describe('PremiumQuizService.restorePublicWithoutSubmission (RIN-1413)', () => {
  function setupWithRecovery() {
    const base = setup();
    const recovery: Mocked<IPremiumSubmissionRecoveryRepository> = {
      restorePublicAfterFailedSubmission: vi.fn(),
    };
    const service = new PremiumQuizService(
      base.quizRepository,
      base.premiumRepository,
      base.attemptRepository,
      recovery,
    );
    return { ...base, service, recovery };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets a quiz saved for Premium back to public when the save never reached a submission', async () => {
    const { service, recovery } = setupWithRecovery();
    recovery.restorePublicAfterFailedSubmission.mockResolvedValue(true);

    await expect(service.restorePublicWithoutSubmission('quiz-1')).resolves.toBe(true);
    expect(recovery.restorePublicAfterFailedSubmission).toHaveBeenCalledWith('quiz-1');
  });

  it('never throws when the flip fails, so the caller keeps its own error', async () => {
    const { service, recovery } = setupWithRecovery();
    recovery.restorePublicAfterFailedSubmission.mockRejectedValue(new Error('still down'));

    await expect(service.restorePublicWithoutSubmission('quiz-1')).resolves.toBe(false);
  });
});
