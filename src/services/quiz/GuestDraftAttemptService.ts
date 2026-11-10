import { QuizAttemptIdempotencyConflictError } from '@/errors/quiz-attempt';
import type { IGuestDraftQuizSource } from '@/interfaces/repositories/IGuestQuizDraftRepository';
import type { IQuizAttemptProgressRepository } from '@/interfaces/repositories/IQuizAttemptProgressRepository';
import type {
  GuestDraftAttemptInput,
  GuestDraftPlayDto,
  IGuestDraftAttemptService,
} from '@/interfaces/services/IGuestDraftAttemptService';
import type { ServiceFailure, ServiceResult } from '@/interfaces/services/types';
import type { QuizAttemptResultDto } from '@/dtos/quiz';
import { hashGuestClaimToken } from '@/lib/guest-claim-token';
import { logger } from '@/lib/logger';
import { copyQuizQuestionFields } from '@/lib/quiz/question-fields';
import { QuizAttemptDtoMapper } from '@/mappers/quiz/QuizAttemptDtoMapper';
import {
  evaluateQuizAttempt,
  InvalidQuizAttemptAnswersError,
} from '@/services/quiz/quiz-attempt-evaluation';

type Clock = () => Date;

const DRAFT_NOT_READY: ServiceFailure = {
  success: false,
  error: 'Guest draft not found',
  statusCode: 404,
};

/**
 * Snapshot slug of a guest-draft attempt. A guest draft has no Quiz slug; this one is
 * reserved (no Quiz slug starts with `guest-draft-`) and stays stable per draft.
 */
export function guestDraftSnapshotSlug(draftId: string): string {
  return `guest-draft-${draftId}`;
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
    return {
      success: true,
      data: {
        title: draft.title,
        questions: draft.questions.map((question) => ({
          ...copyQuizQuestionFields(question),
          type: question.type,
        })),
      },
    };
  }

  async submit(input: GuestDraftAttemptInput): Promise<ServiceResult<QuizAttemptResultDto>> {
    const draft = await this.drafts.findReadyByTokenHash(hashGuestClaimToken(input.token));
    if (!draft) return DRAFT_NOT_READY;
    try {
      const evaluation = evaluateQuizAttempt(draft.questions, input.answers);
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
        answers: evaluation.answers,
        score: evaluation.score,
        correctAnswers: evaluation.correctAnswers,
        totalQuestions: evaluation.totalQuestions,
        wrongQuestions: evaluation.wrongQuestions,
        takenAt: this.now(),
      });
      return {
        success: true,
        data: QuizAttemptDtoMapper.toResultDto(
          attempt.id,
          attempt.score,
          attempt.correctAnswers,
          attempt.totalQuestions,
        ),
      };
    } catch (error) {
      if (error instanceof InvalidQuizAttemptAnswersError) {
        return { success: false, error: error.message, statusCode: 400 };
      }
      if (error instanceof QuizAttemptIdempotencyConflictError) {
        return { success: false, error: error.message, statusCode: 409 };
      }
      logger.error(
        { errorClass: error instanceof Error ? error.name : typeof error },
        'Guest draft attempt failed',
      );
      return {
        success: false,
        error: 'Failed to submit quiz attempt',
        statusCode: 500,
      };
    }
  }
}
