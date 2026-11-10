import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import type { IQuizAttemptProgressRepository } from '@/interfaces/repositories/IQuizAttemptProgressRepository';
import type { IPremiumDecisionNotifier } from '@/interfaces/services/IPremiumDecisionNotifier';
import type { IQuizIndexNowNotifier } from '@/interfaces/services/IIndexNowNotifier';
import type {
  IPremiumQuizRepository,
  IPremiumSubmissionRecoveryRepository,
  AdminCreditGrantResult,
  CreditLedgerListResult,
  CreatePremiumSubmissionData,
  PremiumCatalogListOptions,
  PremiumCatalogListResult,
  PremiumDecisionResult,
  PremiumReviewRequestRecord,
  PremiumSubmissionListOptions,
  PremiumSubmissionListResult,
  PremiumUnlockResult,
} from '@/interfaces/repositories/IPremiumQuizRepository';
import type {
  PremiumAnswer,
  PremiumAccessContext,
  PremiumAccessDecision,
  PremiumDuplicateMatch,
  PremiumDuplicateReport,
  PremiumPlaySession,
  PremiumQuizSnapshot,
  PremiumQuizSubmission,
  PremiumSourceUrl,
} from '@/entities/PremiumQuiz';
import type {
  DecidePremiumSubmissionRequestDto,
  PremiumReviewCallbackRequestDto,
} from '@/dtos/premium-quiz';
import { PremiumQuizError, PremiumSubmissionFailedError } from '@/entities/PremiumQuizError';
import { logger } from '@/lib/logger';
import { notifyQuizIndexNow } from '@/lib/seo/quiz-search-change';
import { getAuthorId } from '@/services/quiz/quiz-helpers';
import { can, resolveEntitlements } from '@/lib/entitlements';
import { env } from '@/lib/env';
import {
  copyPremiumAssetToPrivateStorage,
  getSignedPremiumAssetUrl,
  getSignedPremiumSourceUrl,
} from '@/lib/s3';
import {
  hashPremiumQuestion,
  hashPremiumSnapshot,
  premiumSnapshotSimilarity,
} from '@/services/premium/premium-fingerprints';

const DUPLICATE_CANDIDATE_LIMIT = 500;
const FUZZY_DUPLICATE_THRESHOLD = 0.72;
const MAX_DUPLICATE_MATCHES = 10;
const BATCH_SIZE = 3;

export interface CreatePremiumSubmissionInput {
  quizId: string;
  rightsAttested: true;
  /** Trusted server-side evidence retained by the PDF draft workflow. */
  documentFingerprint?: string;
  /** Trusted private object key; never accepted from a public request body. */
  sourceObjectKey?: string;
}

export interface AdminCreditGrantInput {
  userId: string;
  adminUserId: string;
  amount: number;
  note: string;
  idempotencyKey: string;
}

interface PremiumBatchQuestion {
  id: string;
  question: string;
  options: string[];
  type: 'single' | 'multiple';
  questionImage?: string;
  optionImages?: (string | undefined)[];
}

interface PremiumBatchResponse {
  sessionId: string;
  quizId: string;
  submissionId: string;
  title: string;
  description?: string;
  totalQuestions: number;
  batchIndex: number;
  startIndex: number;
  questions: PremiumBatchQuestion[];
  nextCursor?: string;
  previousCursor?: string;
  watermark: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  currentQuestionIndex: number;
  answers: Array<PremiumAnswer | null>;
}

export interface PremiumFlashcardResponse {
  sessionId: string;
  quizId: string;
  submissionId: string;
  title: string;
  description?: string;
  totalQuestions: number;
  questionIndex: number;
  question: PremiumBatchQuestion;
  revealCursor: string;
  nextCursor?: string;
  previousCursor?: string;
  watermark: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
}

export type PremiumFlashcardRevealResponse =
  | { questionIndex: number; type: 'single'; correctIndex: number }
  | { questionIndex: number; type: 'multiple'; correctIndexes: number[] };

export interface PremiumCatalogMetadata {
  quizId: string;
  title: string;
  description?: string;
  questionCount: number;
}

interface PremiumCursorPayload {
  sessionId: string;
  userId: string;
  snapshotHash: string;
  batchIndex: number;
}

interface PremiumSessionSubmitResult {
  attemptId: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  sessionId: string;
}

interface PremiumPlaySessionStart {
  publication: PremiumQuizSubmission;
  session: PremiumPlaySession;
}

interface PremiumDecodedSessionCursor {
  decoded: PremiumCursorPayload;
  session: PremiumPlaySession;
}

interface PremiumReviewDispatchPayload {
  reviewRequest: PremiumReviewRequestRecord;
  submissionId: string;
  snapshotHash: string;
  sourceType: PremiumQuizSubmission['sourceType'];
  documentFingerprint?: string;
  sourceObjectKey?: string;
  snapshot: PremiumQuizSnapshot;
  duplicateReport: PremiumDuplicateReport;
}

function buildDuplicateReport(
  snapshot: PremiumQuizSnapshot,
  snapshotHash: string,
  questionHashes: string[],
  documentFingerprint: string | undefined,
  candidates: PremiumQuizSubmission[],
): PremiumDuplicateReport {
  const questionHashSet = new Set(questionHashes);
  const matches: PremiumDuplicateMatch[] = [];
  let sharedQuestionCount = 0;
  let highestSimilarity = 0;
  let exactQuiz = false;

  for (const candidate of candidates) {
    const shared = candidate.questionHashes.filter((hash) => questionHashSet.has(hash)).length;
    const similarity = premiumSnapshotSimilarity(snapshot, candidate.snapshot);
    sharedQuestionCount = Math.max(sharedQuestionCount, shared);
    highestSimilarity = Math.max(highestSimilarity, similarity);
    const isExact = candidate.snapshotHash === snapshotHash;
    exactQuiz ||= isExact;
    if (isExact || shared > 0 || similarity >= FUZZY_DUPLICATE_THRESHOLD) {
      matches.push({
        submissionId: candidate.id,
        quizId: candidate.sourceQuizId,
        title: candidate.snapshot.title,
        similarity: isExact ? 1 : similarity,
        reason: isExact ? 'exact_quiz' : shared > 0 ? 'shared_questions' : 'fuzzy',
      });
    }
  }

  return {
    exactDocumentRewarded: Boolean(
      documentFingerprint &&
      candidates.some(
        (candidate) =>
          candidate.documentFingerprint === documentFingerprint && candidate.awardedCredits > 0,
      ),
    ),
    exactQuiz,
    sharedQuestionCount,
    highestSimilarity,
    matches: matches
      .toSorted((left, right) => right.similarity - left.similarity)
      .slice(0, MAX_DUPLICATE_MATCHES),
  };
}

function encodeCursor(payload: PremiumCursorPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', env.AUTH_SECRET).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function decodeCursor(cursor: string): PremiumCursorPayload {
  const [body, signature] = cursor.split('.');
  if (!body || !signature) throw new PremiumQuizError('invalid_cursor', 'Invalid batch cursor');
  const expected = createHmac('sha256', env.AUTH_SECRET).update(body).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new PremiumQuizError('invalid_cursor', 'Invalid batch cursor');
  }
  const value: unknown = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (
    typeof value !== 'object' ||
    value === null ||
    !('sessionId' in value) ||
    !('userId' in value) ||
    !('snapshotHash' in value) ||
    !('batchIndex' in value) ||
    typeof value.sessionId !== 'string' ||
    typeof value.userId !== 'string' ||
    typeof value.snapshotHash !== 'string' ||
    typeof value.batchIndex !== 'number' ||
    !Number.isInteger(value.batchIndex) ||
    value.batchIndex < 0
  ) {
    throw new PremiumQuizError('invalid_cursor', 'Invalid batch cursor');
  }
  return {
    sessionId: value.sessionId,
    userId: value.userId,
    snapshotHash: value.snapshotHash,
    batchIndex: value.batchIndex,
  };
}

async function toBatchQuestion(
  question: PremiumQuizSnapshot['questions'][number],
): Promise<PremiumBatchQuestion> {
  const questionImage = question.questionImage?.startsWith('premium/assets/')
    ? await getSignedPremiumAssetUrl(question.questionImage)
    : undefined;
  const optionImages =
    question.optionImages === undefined
      ? undefined
      : await Promise.all(
          question.optionImages.map((image) =>
            image?.startsWith('premium/assets/') ? getSignedPremiumAssetUrl(image) : undefined,
          ),
        );
  return {
    id: question.id,
    question: question.question,
    options: question.options,
    type: question.type,
    ...(questionImage === undefined ? {} : { questionImage }),
    ...(optionImages === undefined ? {} : { optionImages }),
  };
}

async function privatizeSnapshotAssets(
  snapshot: PremiumQuizSnapshot,
  quizId: string,
): Promise<PremiumQuizSnapshot> {
  try {
    const questions = await Promise.all(
      snapshot.questions.map(async (question) => {
        const questionImage = question.questionImage
          ? await copyPremiumAssetToPrivateStorage(question.questionImage, quizId)
          : undefined;
        const optionImages =
          question.optionImages === undefined
            ? undefined
            : await Promise.all(
                question.optionImages.map((image) =>
                  image ? copyPremiumAssetToPrivateStorage(image, quizId) : undefined,
                ),
              );
        return {
          ...question,
          ...(questionImage === undefined ? {} : { questionImage }),
          ...(optionImages === undefined ? {} : { optionImages }),
        };
      }),
    );
    return { ...snapshot, questions };
  } catch (error) {
    throw new PremiumQuizError(
      'invalid_state',
      error instanceof Error ? error.message : 'Premium quiz assets could not be secured',
    );
  }
}

export class PremiumQuizService {
  constructor(
    private readonly quizRepository: IQuizRepository,
    private readonly premiumRepository: IPremiumQuizRepository,
    private readonly attemptRepository: IQuizAttemptProgressRepository,
    private readonly submissionRecovery?: IPremiumSubmissionRecoveryRepository,
    private readonly decisionNotifier?: IPremiumDecisionNotifier,
    private readonly quizIndexNow?: IQuizIndexNowNotifier,
  ) {}

  async assertCanContribute(userId: string): Promise<void> {
    if (!(await this.premiumRepository.isVerifiedUser(userId))) {
      throw new PremiumQuizError(
        'email_verification_required',
        'Verify your email before submitting Premium quizzes',
      );
    }
  }

  async createSubmission(
    userId: string,
    input: CreatePremiumSubmissionInput,
  ): Promise<PremiumQuizSubmission> {
    await this.assertCanContribute(userId);
    const quiz = await this.quizRepository.findById(input.quizId);
    if (!quiz) throw new PremiumQuizError('not_found', 'Quiz not found');
    if (getAuthorId(quiz.author) !== userId) {
      throw new PremiumQuizError('forbidden', 'Only the quiz owner can submit it');
    }

    if (
      input.sourceObjectKey !== undefined &&
      !input.sourceObjectKey.startsWith('uploads/premium_sources/')
    ) {
      throw new PremiumQuizError('invalid_state', 'Premium source document key is invalid');
    }
    const sourceSnapshot: PremiumQuizSnapshot = {
      title: quiz.title,
      slug: quiz.slug,
      questions: quiz.questions,
      ...(quiz.description === undefined ? {} : { description: quiz.description }),
    };
    const snapshot = await privatizeSnapshotAssets(sourceSnapshot, quiz.id);
    const snapshotHash = hashPremiumSnapshot(snapshot);
    const questionHashes = snapshot.questions.map(hashPremiumQuestion);
    const candidates =
      await this.premiumRepository.findDuplicateCandidates(DUPLICATE_CANDIDATE_LIMIT);
    const data: CreatePremiumSubmissionData = {
      sourceQuizId: quiz.id,
      authorId: userId,
      sourceType:
        input.sourceObjectKey !== undefined || quiz.pdfUrl !== undefined ? 'pdf' : 'manual',
      rightsAttested: input.rightsAttested,
      snapshot,
      snapshotHash,
      questionHashes,
      duplicateReport: buildDuplicateReport(
        snapshot,
        snapshotHash,
        questionHashes,
        input.documentFingerprint,
        candidates,
      ),
      ...(input.documentFingerprint === undefined
        ? {}
        : { documentFingerprint: input.documentFingerprint }),
      ...(input.sourceObjectKey === undefined ? {} : { sourceObjectKey: input.sourceObjectKey }),
    };
    return this.premiumRepository.createSubmission(data);
  }

  /**
   * RIN-1347: submits a quiz the caller has just saved as `personal`. When the
   * submission fails, the quiz goes back to public (unless an older submission
   * still holds it private) and a `premium_submission_failed` error says so;
   * otherwise the original error is rethrown unchanged. Storage copies cannot
   * join a Mongo transaction, so this compensates instead.
   */
  async submitSavedQuiz(
    userId: string,
    input: CreatePremiumSubmissionInput,
  ): Promise<PremiumQuizSubmission> {
    try {
      return await this.createSubmission(userId, input);
    } catch (error) {
      if (!(await this.restorePublic(input.quizId))) throw error;
      throw new PremiumSubmissionFailedError(input.quizId, error);
    }
  }

  /**
   * RIN-1413: the caller saved the quiz `personal` for Premium but failed
   * before it could call `submitSavedQuiz`. Sets it back to public under the
   * same rules; never throws, so the caller keeps its own error.
   */
  async restorePublicWithoutSubmission(quizId: string): Promise<boolean> {
    return this.restorePublic(quizId);
  }

  private async restorePublic(quizId: string): Promise<boolean> {
    if (!this.submissionRecovery) return false;
    try {
      const restored = await this.submissionRecovery.restorePublicAfterFailedSubmission(quizId);
      if (restored) this.notifyMadePublic(quizId);
      return restored;
    } catch (error) {
      logger.error({ error, quizId }, 'Premium submission failed and the quiz stayed private');
      return false;
    }
  }

  async listMine(
    userId: string,
    options: PremiumSubmissionListOptions,
  ): Promise<PremiumSubmissionListResult> {
    return this.premiumRepository.listMine(userId, options);
  }

  async listAdmin(options: PremiumSubmissionListOptions): Promise<PremiumSubmissionListResult> {
    return this.premiumRepository.listAdmin(options);
  }

  /**
   * A signed-in learner also sees which cards they already unlocked with
   * credit (RIN-1014). Premium subscribers and admins can open every card, so
   * only credit grants count as "unlocked".
   */
  async listCatalog(
    options: PremiumCatalogListOptions,
    userId?: string | null,
  ): Promise<PremiumCatalogListResult> {
    const catalog = await this.premiumRepository.listCatalog(options);
    if (!userId || catalog.items.length === 0) return catalog;
    const granted = new Set(
      await this.premiumRepository.findGrantedQuizIds(
        userId,
        catalog.items.map((item) => item.quizId),
      ),
    );
    return {
      ...catalog,
      items: catalog.items.map((item) => ({ ...item, unlocked: granted.has(item.quizId) })),
    };
  }

  async getAdminSubmission(id: string): Promise<PremiumQuizSubmission> {
    const submission = await this.premiumRepository.findSubmissionById(id);
    if (!submission) throw new PremiumQuizError('not_found', 'Submission not found');
    return submission;
  }

  async getAdminSourceUrl(id: string): Promise<PremiumSourceUrl> {
    const submission = await this.getAdminSubmission(id);
    if (!submission.sourceObjectKey) {
      throw new PremiumQuizError('not_found', 'This submission has no retained source PDF');
    }
    const expiresIn = 300;
    return {
      url: await getSignedPremiumSourceUrl(submission.sourceObjectKey, expiresIn),
      expiresIn,
    };
  }

  async decide(
    reviewerId: string,
    submissionId: string,
    input: DecidePremiumSubmissionRequestDto,
  ): Promise<PremiumDecisionResult> {
    const result = await this.premiumRepository.decide({
      submissionId,
      reviewerId,
      decision: input.decision,
      credits: input.credits,
      ...(input.note === undefined ? {} : { note: input.note }),
      ...(input.overrideReason === undefined ? {} : { overrideReason: input.overrideReason }),
    });
    if (result.quizMadePublic === true) this.notifyMadePublic(result.submission.sourceQuizId);
    if (input.decision === 'reject') await this.queueRejectEmail(result);
    return result;
  }

  /** RIN-1500: the quiz is public now and may be indexable; never throws. */
  private notifyMadePublic(quizId: string): void {
    notifyQuizIndexNow(this.quizIndexNow, { quizId, cause: 'made-public' });
  }

  /** The author's reject email (RIN-1348); a failure to queue it never undoes the decision. */
  private async queueRejectEmail(result: PremiumDecisionResult): Promise<void> {
    if (!this.decisionNotifier || result.submission.status !== 'rejected') return;
    try {
      await this.decisionNotifier.queueRejectEmail({
        submission: result.submission,
        quizMadePublic: result.quizMadePublic === true,
      });
    } catch (error) {
      logger.warn(
        {
          submissionId: result.submission.id,
          errorName: error instanceof Error ? error.name : 'unknown',
        },
        'Premium reject email not queued',
      );
    }
  }

  async createReviewDispatch(
    requestedBy: string,
    submissionId: string,
  ): Promise<PremiumReviewDispatchPayload> {
    const submission = await this.getAdminSubmission(submissionId);
    if (!['pending', 'changes_requested'].includes(submission.status)) {
      throw new PremiumQuizError('invalid_state', 'Only reviewable submissions can be evaluated');
    }
    const reviewRequest = await this.premiumRepository.beginReview({
      submissionId,
      requestedBy,
      snapshotHash: submission.snapshotHash,
    });
    return {
      reviewRequest,
      submissionId,
      snapshotHash: submission.snapshotHash,
      sourceType: submission.sourceType,
      snapshot: submission.snapshot,
      duplicateReport: submission.duplicateReport,
      ...(submission.documentFingerprint === undefined
        ? {}
        : { documentFingerprint: submission.documentFingerprint }),
      ...(submission.sourceObjectKey === undefined
        ? {}
        : { sourceObjectKey: submission.sourceObjectKey }),
    };
  }

  async syncReview(
    submissionId: string,
    reviewRequestId: string,
    input: PremiumReviewCallbackRequestDto,
  ): Promise<PremiumQuizSubmission> {
    return this.premiumRepository.updateReview({
      submissionId,
      snapshotHash: input.snapshotHash,
      jobId: reviewRequestId,
      status: input.status,
      ...(input.result === undefined ? {} : { result: input.result }),
      ...(input.error === undefined ? {} : { error: input.error }),
    });
  }

  async getCredits(userId: string, limit = 50): Promise<CreditLedgerListResult> {
    return this.premiumRepository.getWalletAndLedger(userId, limit);
  }

  async grantAdminCredits(input: AdminCreditGrantInput): Promise<AdminCreditGrantResult> {
    return this.premiumRepository.grantAdminCredits({
      ...input,
      note: input.note.trim(),
    });
  }

  async unlock(
    userId: string,
    quizId: string,
    idempotencyKey: string,
  ): Promise<PremiumUnlockResult> {
    return this.premiumRepository.unlock({ userId, quizId, idempotencyKey });
  }

  async canAccess(
    context: PremiumAccessContext,
    quizId: string,
    authorId?: string,
  ): Promise<PremiumAccessDecision> {
    if (context.role === 'admin' || authorId === context.userId) return true;
    const entitlements = await resolveEntitlements(context.userId);
    if (can(entitlements, 'premium_catalog')) return true;
    return this.premiumRepository.hasGrant(context.userId, quizId);
  }

  async canAccessAttempt(
    context: PremiumAccessContext,
    quizId: string,
    submissionId: string,
    snapshotHash: string,
  ): Promise<PremiumAccessDecision> {
    const publication = await this.premiumRepository.findSubmissionById(submissionId);
    if (
      !publication ||
      publication.sourceQuizId !== quizId ||
      publication.snapshotHash !== snapshotHash
    ) {
      return false;
    }
    return this.canAccess(context, quizId, publication.authorId);
  }

  async canAccessPublishedQuiz(
    context: PremiumAccessContext,
    quizId: string,
  ): Promise<PremiumAccessDecision> {
    const publication = await this.premiumRepository.findActivePublicationByQuizId(quizId);
    return publication ? this.canAccess(context, quizId, publication.authorId) : false;
  }

  async getCatalogMetadataBySlug(slug: string): Promise<PremiumCatalogMetadata | null> {
    const publication = await this.premiumRepository.findActivePublicationBySlug(slug);
    if (!publication) return null;
    return {
      quizId: publication.sourceQuizId,
      title: publication.snapshot.title,
      questionCount: publication.snapshot.questions.length,
      ...(publication.snapshot.description === undefined
        ? {}
        : { description: publication.snapshot.description }),
    };
  }

  async startFlashcardSession(
    context: PremiumAccessContext,
    quizId: string,
  ): Promise<PremiumFlashcardResponse> {
    const { publication, session } = await this.beginPlaySession(context, quizId);
    const questionIndex = Math.min(
      session.currentQuestionIndex,
      publication.snapshot.questions.length - 1,
    );
    return this.buildFlashcard(publication, session, questionIndex);
  }

  async getFlashcard(
    userId: string,
    sessionId: string,
    cursor: string,
  ): Promise<PremiumFlashcardResponse> {
    const { decoded, session } = await this.decodeSessionCursor(sessionId, userId, cursor);
    await this.requireBatchQuota(sessionId, userId, 'Too many Premium flashcard requests');
    const publication = await this.requireFreshSessionPublication(session, decoded);
    return this.buildFlashcard(publication, session, decoded.batchIndex);
  }

  async revealFlashcard(
    userId: string,
    sessionId: string,
    cursor: string,
  ): Promise<PremiumFlashcardRevealResponse> {
    const { decoded, session } = await this.decodeSessionCursor(sessionId, userId, cursor);
    if (decoded.snapshotHash !== session.snapshotHash) {
      throw new PremiumQuizError('invalid_cursor', 'Cursor snapshot is stale');
    }
    const publication = await this.premiumRepository.findSubmissionById(session.submissionId);
    const question = publication?.snapshot.questions[decoded.batchIndex];
    if (!publication || publication.snapshotHash !== session.snapshotHash || !question) {
      throw new PremiumQuizError('invalid_cursor', 'Flashcard is unavailable');
    }
    return question.type === 'single'
      ? { questionIndex: decoded.batchIndex, type: 'single', correctIndex: question.correctIndex }
      : {
          questionIndex: decoded.batchIndex,
          type: 'multiple',
          correctIndexes: question.correctIndexes,
        };
  }

  async startSession(context: PremiumAccessContext, quizId: string): Promise<PremiumBatchResponse> {
    const { publication, session } = await this.beginPlaySession(context, quizId);
    return this.buildBatch(
      publication,
      session,
      Math.floor(session.currentQuestionIndex / BATCH_SIZE),
    );
  }

  async getBatch(
    context: PremiumAccessContext,
    sessionId: string,
    cursor: string,
  ): Promise<PremiumBatchResponse> {
    const { decoded, session } = await this.decodeSessionCursor(sessionId, context.userId, cursor);
    await this.requireBatchQuota(sessionId, context.userId, 'Too many Premium batch requests');
    const publication = await this.requireFreshSessionPublication(session, decoded);
    return this.buildBatch(publication, session, decoded.batchIndex);
  }

  async saveProgress(
    userId: string,
    sessionId: string,
    questionIndex: number,
    answer: PremiumAnswer,
  ): Promise<PremiumPlaySession> {
    const session = await this.requireActiveSession(sessionId, userId);
    const publication = await this.premiumRepository.findSubmissionById(session.submissionId);
    const question = publication?.snapshot.questions[questionIndex];
    if (!publication || !question) {
      throw new PremiumQuizError('invalid_state', 'Question does not exist in this session');
    }
    if (
      (question.type === 'single' && Array.isArray(answer)) ||
      (question.type === 'multiple' && !Array.isArray(answer))
    ) {
      throw new PremiumQuizError('invalid_state', 'Answer type does not match question type');
    }
    const updated = await this.premiumRepository.updateProgress({
      sessionId,
      userId,
      questionIndex,
      answer,
      now: new Date(),
    });
    if (!updated) throw new PremiumQuizError('session_expired', 'Premium session expired');
    return updated;
  }

  async submitSession(
    userId: string,
    sessionId: string,
    idempotencyKey: string,
  ): Promise<PremiumSessionSubmitResult> {
    const session = await this.premiumRepository.findSession(sessionId, userId);
    if (!session) throw new PremiumQuizError('session_expired', 'Premium session expired');
    const claim = await this.premiumRepository.claimSessionSubmission(
      sessionId,
      userId,
      idempotencyKey,
      new Date(),
    );
    if (claim === 'conflict') {
      throw new PremiumQuizError('conflict', 'This session was submitted with another request');
    }
    if (claim === 'expired') {
      throw new PremiumQuizError('session_expired', 'Premium session expired');
    }
    const publication = await this.premiumRepository.findSubmissionById(session.submissionId);
    if (!publication || publication.snapshotHash !== session.snapshotHash) {
      throw new PremiumQuizError('conflict', 'Published quiz version is unavailable');
    }
    let correctAnswers = 0;
    const answers = publication.snapshot.questions.map((question, index) => {
      const answer = session.answers[index] ?? (question.type === 'single' ? -1 : []);
      if (question.type === 'single' && typeof answer === 'number') {
        if (answer === question.correctIndex) correctAnswers += 1;
      } else if (question.type === 'multiple' && Array.isArray(answer)) {
        const expected = question.correctIndexes.toSorted((left, right) => left - right);
        const actual = answer.toSorted((left, right) => left - right);
        if (
          expected.length === actual.length &&
          expected.every((value, answerIndex) => value === actual[answerIndex])
        ) {
          correctAnswers += 1;
        }
      }
      return answer;
    });
    const totalQuestions = publication.snapshot.questions.length;
    const score = Math.round((correctAnswers / totalQuestions) * 100);
    const wrongQuestions = publication.snapshot.questions
      .map((question, index) => ({ question, index }))
      .filter(({ question, index }) => {
        const answer = answers[index];
        if (question.type === 'single') return answer !== question.correctIndex;
        if (!Array.isArray(answer)) return true;
        const expected = question.correctIndexes.toSorted((left, right) => left - right);
        const actual = answer.toSorted((left, right) => left - right);
        return (
          expected.length !== actual.length ||
          expected.some((value, answerIndex) => value !== actual[answerIndex])
        );
      })
      .map(({ question }) => ({ questionId: question.id, question }));
    const attempt = await this.attemptRepository.recordSubmittedAttempt({
      userId,
      idempotencyKey,
      quizId: session.quizId,
      quizSlug: publication.snapshot.slug,
      premiumSubmissionId: publication.id,
      premiumSnapshotHash: publication.snapshotHash,
      quizSnapshot: { integrity: 'complete', ...publication.snapshot },
      answers,
      score,
      correctAnswers,
      totalQuestions,
      wrongQuestions,
      takenAt: new Date(),
    });
    if (session.completedAt === undefined) {
      const completed = await this.premiumRepository.completeSession(sessionId, userId, new Date());
      if (!completed) throw new PremiumQuizError('session_expired', 'Premium session expired');
    }
    return {
      attemptId: attempt.id,
      score,
      correctAnswers,
      totalQuestions,
      sessionId,
    };
  }

  private async requireActiveSession(
    sessionId: string,
    userId: string,
  ): Promise<PremiumPlaySession> {
    const session = await this.premiumRepository.findSession(sessionId, userId);
    const now = Date.now();
    if (
      !session ||
      session.completedAt !== undefined ||
      session.idleExpiresAt.getTime() <= now ||
      session.absoluteExpiresAt.getTime() <= now
    ) {
      throw new PremiumQuizError('session_expired', 'Premium session expired');
    }
    return session;
  }

  private async beginPlaySession(
    context: PremiumAccessContext,
    quizId: string,
  ): Promise<PremiumPlaySessionStart> {
    const publication = await this.premiumRepository.findActivePublicationByQuizId(quizId);
    if (!publication) throw new PremiumQuizError('not_found', 'Premium quiz not found');
    if (!(await this.canAccess(context, quizId, publication.authorId))) {
      throw new PremiumQuizError(
        'unlock_required',
        'Premium subscription or one credit is required',
      );
    }
    const session = await this.premiumRepository.createSession({
      userId: context.userId,
      quizId,
      submissionId: publication.id,
      snapshotHash: publication.snapshotHash,
      now: new Date(),
    });
    return { publication, session };
  }

  private async decodeSessionCursor(
    sessionId: string,
    userId: string,
    cursor: string,
  ): Promise<PremiumDecodedSessionCursor> {
    const decoded = decodeCursor(cursor);
    if (decoded.sessionId !== sessionId || decoded.userId !== userId) {
      throw new PremiumQuizError('invalid_cursor', 'Cursor does not belong to this session');
    }
    const session = await this.requireActiveSession(sessionId, userId);
    return { decoded, session };
  }

  private async requireBatchQuota(
    sessionId: string,
    userId: string,
    rateLimitMessage: string,
  ): Promise<void> {
    if (!(await this.premiumRepository.consumeBatchQuota(sessionId, userId, new Date()))) {
      throw new PremiumQuizError('rate_limited', rateLimitMessage);
    }
  }

  private async requireFreshSessionPublication(
    session: PremiumPlaySession,
    decoded: PremiumCursorPayload,
  ): Promise<PremiumQuizSubmission> {
    if (decoded.snapshotHash !== session.snapshotHash) {
      throw new PremiumQuizError('invalid_cursor', 'Cursor snapshot is stale');
    }
    const publication = await this.premiumRepository.findSubmissionById(session.submissionId);
    if (!publication || publication.snapshotHash !== session.snapshotHash) {
      throw new PremiumQuizError('conflict', 'Published quiz version is unavailable');
    }
    return publication;
  }

  private buildCursorBase(
    publication: PremiumQuizSubmission,
    session: PremiumPlaySession,
  ): Omit<PremiumCursorPayload, 'batchIndex'> {
    return {
      sessionId: session.id,
      userId: session.userId,
      snapshotHash: publication.snapshotHash,
    };
  }

  private buildWatermark(session: PremiumPlaySession): string {
    const watermarkIdentity = createHash('sha256')
      .update(`${session.userId}:${session.id}`)
      .digest('hex')
      .slice(0, 10)
      .toUpperCase();
    return `${watermarkIdentity} · ${session.sessionCode} · ${new Date().toISOString()}`;
  }

  private async buildBatch(
    publication: PremiumQuizSubmission,
    session: PremiumPlaySession,
    batchIndex: number,
  ): Promise<PremiumBatchResponse> {
    const startIndex = batchIndex * BATCH_SIZE;
    const questions = publication.snapshot.questions.slice(startIndex, startIndex + BATCH_SIZE);
    if (questions.length === 0)
      throw new PremiumQuizError('invalid_cursor', 'Batch is out of range');
    const totalBatches = Math.ceil(publication.snapshot.questions.length / BATCH_SIZE);
    const cursorBase = this.buildCursorBase(publication, session);
    return {
      sessionId: session.id,
      quizId: publication.sourceQuizId,
      submissionId: publication.id,
      title: publication.snapshot.title,
      totalQuestions: publication.snapshot.questions.length,
      batchIndex,
      startIndex,
      questions: await Promise.all(questions.map(toBatchQuestion)),
      watermark: this.buildWatermark(session),
      idleExpiresAt: session.idleExpiresAt.toISOString(),
      absoluteExpiresAt: session.absoluteExpiresAt.toISOString(),
      currentQuestionIndex: session.currentQuestionIndex,
      answers: Array.from(
        { length: publication.snapshot.questions.length },
        (_, index) => session.answers[index] ?? null,
      ),
      ...(publication.snapshot.description === undefined
        ? {}
        : { description: publication.snapshot.description }),
      ...(batchIndex + 1 >= totalBatches
        ? {}
        : { nextCursor: encodeCursor({ ...cursorBase, batchIndex: batchIndex + 1 }) }),
      ...(batchIndex === 0
        ? {}
        : { previousCursor: encodeCursor({ ...cursorBase, batchIndex: batchIndex - 1 }) }),
    };
  }

  private async buildFlashcard(
    publication: PremiumQuizSubmission,
    session: PremiumPlaySession,
    questionIndex: number,
  ): Promise<PremiumFlashcardResponse> {
    const question = publication.snapshot.questions[questionIndex];
    if (!question) throw new PremiumQuizError('invalid_cursor', 'Flashcard is out of range');
    const cursorBase = this.buildCursorBase(publication, session);
    return {
      sessionId: session.id,
      quizId: publication.sourceQuizId,
      submissionId: publication.id,
      title: publication.snapshot.title,
      totalQuestions: publication.snapshot.questions.length,
      questionIndex,
      question: await toBatchQuestion(question),
      revealCursor: encodeCursor({ ...cursorBase, batchIndex: questionIndex }),
      watermark: this.buildWatermark(session),
      idleExpiresAt: session.idleExpiresAt.toISOString(),
      absoluteExpiresAt: session.absoluteExpiresAt.toISOString(),
      ...(publication.snapshot.description === undefined
        ? {}
        : { description: publication.snapshot.description }),
      ...(questionIndex + 1 >= publication.snapshot.questions.length
        ? {}
        : { nextCursor: encodeCursor({ ...cursorBase, batchIndex: questionIndex + 1 }) }),
      ...(questionIndex === 0
        ? {}
        : { previousCursor: encodeCursor({ ...cursorBase, batchIndex: questionIndex - 1 }) }),
    };
  }
}
