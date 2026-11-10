import { QuizAttemptIdempotencyConflictError } from '@/errors/quiz-attempt';
import type { IGuestDraftQuizSource } from '@/interfaces/repositories/IGuestQuizDraftRepository';
import type { IQuizAttemptProgressRepository } from '@/interfaces/repositories/IQuizAttemptProgressRepository';
import type {
  GuestDraftAttemptInput,
  IGuestDraftAttemptService,
} from '@/interfaces/services/IGuestDraftAttemptService';
import type { ServiceFailure, ServiceResult } from '@/interfaces/services/types';
import type { GuestDraftPlayDto } from '@/dtos/guest-draft';
import type { QuizAttemptResultDto } from '@/dtos/quiz';
import { hashGuestClaimToken } from '@/lib/guest-claim-token';
import { logger } from '@/lib/logger';
import { GuestDraftDtoMapper } from '@/mappers/quiz/GuestDraftDtoMapper';
import { QuizAttemptDtoMapper } from '@/mappers/quiz/QuizAttemptDtoMapper';
import {
  evaluateQuizAttempt,
  InvalidQuizAttemptAnswersError,
} from '@/services/quiz/quiz-attempt-evaluation';
import { guestDraftSnapshotSlug } from '@/shared/constants/guest-draft';

type Clock = () => Date;

const DRAFT_NOT_READY: ServiceFailure = {
  success: false,
  error: 'Guest draft not found',
  statusCode: 404,
};

/** Same statuses as the RIN-912 submit: bad answers 400, a reused key 409. */
function submitFailure(error: unknown): ServiceFailure {
  const known =
    error instanceof InvalidQuizAttemptAnswersError
      ? 400
      : error instanceof QuizAttemptIdempotencyConflictError
        ? 409
        : null;
  if (known !== null) return { success: false, error: (error as Error).message, statusCode: known };
  logger.error(
    { errorClass: error instanceof Error ? error.name : typeof error },
    'Guest draft attempt failed',
  );
  return { success: false, error: 'Failed to submit quiz attempt', statusCode: 500 };
}

/**
 * Play and a server-scored attempt on a ready guest draft (RIN-1446 item 4). The attempt is
 * a RIN-912 guest attempt: the same evaluation, the same repository write, owned only by the
 * claim token's hash, with the guest draft's id as `quiz` and a complete snapshot, so the
 * result view and the sign-up claim work unchanged.
 */
export class GuestDraftAttemptService implements IGuestDraftAttemptService {
  constructor(
    private readonly drafts: IGuestDraftQuizSource,
    private readonly attempts: IQuizAttemptProgressRepository,
    private readonly now: Clock = () => new Date(),
  ) {}

  async play(token: string): Promise<ServiceResult<GuestDraftPlayDto>> {
    const draft = await this.drafts.findReadyByTokenHash(hashGuestClaimToken(token));
    if (!draft) return DRAFT_NOT_READY;
    return { success: true, data: GuestDraftDtoMapper.toPlay(draft) };
  }

  async submit(input: GuestDraftAttemptInput): Promise<ServiceResult<QuizAttemptResultDto>> {
    const draft = await this.drafts.findReadyByTokenHash(hashGuestClaimToken(input.token));
    if (!draft) return DRAFT_NOT_READY;
    try {
      const { answers, score, correctAnswers, totalQuestions, wrongQuestions } =
        evaluateQuizAttempt(draft.questions, input.answers);
      const slug = guestDraftSnapshotSlug(draft.id);
      const attempt = await this.attempts.recordSubmittedAttempt({
        guestClaimTokenHash: hashGuestClaimToken(input.guestClaimToken),
        idempotencyKey: input.idempotencyKey,
        quizId: draft.id,
        quizSlug: slug,
        quizSnapshot: {
          integrity: 'complete',
          title: draft.title,
          slug,
          questions: draft.questions,
        },
        answers,
        score,
        correctAnswers,
        totalQuestions,
        wrongQuestions,
        takenAt: this.now(),
      });
      const result = QuizAttemptDtoMapper.toResultDto(
        attempt.id,
        attempt.score,
        attempt.correctAnswers,
        attempt.totalQuestions,
      );
      return { success: true, data: result };
    } catch (error) {
      return submitFailure(error);
    }
  }
}
