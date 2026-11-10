import {
  IQuizRepository,
  type QuizAccessRecord,
  type UpdateQuizData,
} from '@/interfaces/repositories/IQuizRepository';
import type { Quiz, QuizContentFlags, QuizQuestionContent } from '@/entities/Quiz';
import type { IFolderRepository } from '@/interfaces/repositories/IFolderRepository';
import type { IPremiumSubmissionWithdrawalRepository } from '@/interfaces/repositories/IPremiumQuizRepository';
import type { IQuizIndexNowNotifier } from '@/interfaces/services/IIndexNowNotifier';
import type {
  CreateQuizRequestDto,
  QuizDetailDto,
  QuizMetadataDto,
  UpdateQuizRequestDto,
} from '@/dtos/quiz';
import { isNonIndexableQuizOwner } from '@/shared/constants/analytics-exclusions';
import { detectQuizContentLocale } from '@/lib/seo/quiz-indexability';
import { notifyQuizSearchChange } from '@/lib/seo/quiz-search-change';
import type { DeleteResultDto } from '@/dtos/common';
import type { ServiceFailure } from '@/interfaces/services/types';
import { ServiceResult } from '@/interfaces/services/types';
import { generateSlug } from '@/lib/utils';
import { getAuthorId } from './quiz-helpers';
import { logger } from '@/lib/logger';
import { QuizCreationError } from '@/lib/quiz/errors';
import { isMongoDuplicateKeyError, isMongoDuplicateKeyErrorForField } from '@/lib/mongoose-errors';
import { QuizDetailDtoMapper } from '@/mappers/quiz/QuizDetailDtoMapper';
import { DeleteResultDtoMapper } from '@/mappers/common/DeleteResultDtoMapper';
import { QuizListDtoMapper } from '@/mappers/quiz/QuizListDtoMapper';
import { copyQuizQuestionContentFields } from '@/lib/quiz/question-fields';
import { isPersonalDataFlagged, resolveQuizContentFlags } from '@/lib/quiz/personal-data';

const MAX_SLUG_CREATE_ATTEMPTS = 20;

function touchesQuizContent(updateData: UpdateQuizData): boolean {
  return (
    updateData.title !== undefined ||
    updateData.description !== undefined ||
    updateData.questions !== undefined
  );
}

function toQuizQuestionContent(
  question: CreateQuizRequestDto['questions'][number],
): QuizQuestionContent {
  const base = copyQuizQuestionContentFields(question);

  return question.type === 'single'
    ? { ...base, type: 'single', correctIndex: question.correctIndex }
    : { ...base, type: 'multiple', correctIndexes: question.correctIndexes };
}

/**
 * RIN-1346: unticking Premium makes the quiz public and withdraws its open
 * submissions in one transaction, so nothing left in the admin queue can sell
 * a free quiz. Mirrors the admin rule (QuizAdminService.setQuizVisibility): a
 * quiz on sale in Premium stays private.
 */
async function makePublicWithdrawingSubmissions(
  withdrawal: IPremiumSubmissionWithdrawalRepository,
  id: string,
): Promise<ServiceFailure | null> {
  const result = await withdrawal.makeQuizPublicAndWithdrawSubmissions(id);
  if (result.outcome === 'made_public') return null;
  return {
    success: false,
    code: 'premium_published',
    error: 'This quiz is on sale in Premium. Ask support to remove it from Premium first.',
    statusCode: 409,
  };
}

export class QuizCrudService {
  constructor(
    private quizRepository: IQuizRepository,
    private folderRepository?: IFolderRepository,
    private premiumWithdrawal?: IPremiumSubmissionWithdrawalRepository,
    private quizIndexNow?: IQuizIndexNowNotifier,
  ) {}

  async createQuiz(userId: string, quizData: CreateQuizRequestDto): Promise<QuizDetailDto> {
    return QuizDetailDtoMapper.toDetail(await this.createQuizRecord(userId, quizData));
  }

  async createQuizFromDraft(
    userId: string,
    sourceDraftId: string,
    quizData: CreateQuizRequestDto,
  ): Promise<QuizDetailDto> {
    const existing = await this.quizRepository.findBySourceDraftId(sourceDraftId);
    if (existing) {
      if (getAuthorId(existing.author) !== userId) {
        throw new QuizCreationError('invalid_draft', 'Draft belongs to another user');
      }
      return QuizDetailDtoMapper.toDetail(existing);
    }

    try {
      return QuizDetailDtoMapper.toDetail(
        await this.createQuizRecord(userId, quizData, sourceDraftId),
      );
    } catch (error) {
      if (!isMongoDuplicateKeyError(error)) {
        throw error;
      }

      const concurrentlyCreated = await this.quizRepository.findBySourceDraftId(sourceDraftId);
      if (!concurrentlyCreated || getAuthorId(concurrentlyCreated.author) !== userId) {
        throw error;
      }
      return QuizDetailDtoMapper.toDetail(concurrentlyCreated);
    }
  }

  private async createQuizRecord(
    userId: string,
    quizData: CreateQuizRequestDto,
    sourceDraftId?: string,
  ): Promise<Quiz> {
    const { title, description, folderId, questions, submitToPremium, pdfUrl } = quizData;

    if (folderId) {
      const ownsFolder = await this.folderRepository?.existsOwnedById(folderId, userId);
      if (!ownsFolder) {
        throw new QuizCreationError('invalid_folder', 'Invalid folder selected');
      }
    }

    const baseSlug = generateSlug(title);
    const quizQuestions = questions.map(toQuizQuestionContent);
    // RIN-1338: kind names only; matched values are never stored or logged.
    const contentFlags = resolveQuizContentFlags(
      { title, description, questions: quizQuestions },
      undefined,
      new Date(),
    );

    for (let attempt = 0; attempt < MAX_SLUG_CREATE_ATTEMPTS; attempt += 1) {
      const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`;

      try {
        return await this.quizRepository.create({
          title,
          ...(description !== undefined && { description }),
          slug,
          author: userId,
          folder: folderId ?? null,
          questions: quizQuestions,
          visibility: submitToPremium ? 'personal' : 'public',
          contentFlags,
          ...(pdfUrl !== undefined && { pdfUrl }),
          ...(sourceDraftId !== undefined && { sourceDraftId }),
        });
      } catch (error) {
        if (!isMongoDuplicateKeyErrorForField(error, 'slug')) {
          throw error;
        }
      }
    }

    throw new QuizCreationError('slug_conflict', 'Could not generate a unique quiz slug');
  }

  private async authorizeQuizMutation(
    id: string,
    userId: string,
    userRole?: string,
  ): Promise<ServiceResult<QuizAccessRecord>> {
    const quiz = await this.quizRepository.findAccessById(id);

    if (!quiz) {
      return {
        success: false,
        error: 'Quiz not found',
        statusCode: 404,
      };
    }

    const isAdmin = userRole === 'admin';
    const isAuthor = getAuthorId(quiz.author) === userId;

    if (!isAdmin && !isAuthor) {
      return {
        success: false,
        error: 'Access denied',
        statusCode: 403,
      };
    }

    return { success: true, data: quiz };
  }

  async getQuizMetadataBySlug(slug: string): Promise<QuizMetadataDto | null> {
    const record = await this.quizRepository.findMetadataBySlug(slug);
    if (!record) return null;
    const leadQuestionTexts = [...(record.leadQuestionTexts ?? [])];
    return {
      ...QuizListDtoMapper.toListItem(record.quiz),
      ownerIndexable: record.owner === null || !isNonIndexableQuizOwner(record.owner),
      personalDataFlagged: isPersonalDataFlagged(record.quiz.contentFlags),
      indexHold: record.quiz.indexHold !== undefined,
      leadQuestionTexts,
      contentLocale: detectQuizContentLocale(record.quiz.title, leadQuestionTexts),
    };
  }

  async getQuizById(
    id: string,
    userId?: string,
    userRole?: string,
  ): Promise<ServiceResult<QuizDetailDto>> {
    try {
      // Author/admin only: QuizDetailDto includes answer keys (correctIndex/correctIndexes).
      // Read access for play uses a different path that strips answers.
      const quiz = await this.quizRepository.findById(id);

      if (!quiz) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404,
        };
      }

      const isAdmin = userRole === 'admin';
      const isAuthor = userId !== undefined && getAuthorId(quiz.author) === userId;

      if (!isAdmin && !isAuthor) {
        return {
          success: false,
          error: 'Access denied',
          statusCode: 403,
        };
      }

      return { success: true, data: QuizDetailDtoMapper.toDetail(quiz) };
    } catch (error) {
      logger.error({ error }, 'Error in getQuizById');
      return {
        success: false,
        error: 'Internal server error',
        statusCode: 500,
      };
    }
  }

  async updateQuiz(
    id: string,
    quizData: UpdateQuizRequestDto,
    userId: string,
    userRole?: string,
  ): Promise<ServiceResult<QuizDetailDto>> {
    try {
      const authorization = await this.authorizeQuizMutation(id, userId, userRole);
      if (!authorization.success) return authorization;

      if (quizData.folder) {
        const ownsFolder = await this.folderRepository?.existsOwnedById(quizData.folder, userId);
        if (!ownsFolder) {
          return {
            success: false,
            error: 'Invalid folder selected',
            statusCode: 400,
          };
        }
      }

      const makesPublic = quizData.submitToPremium === false;
      const withdrawal = this.premiumWithdrawal;
      if (makesPublic && !withdrawal) {
        logger.error('Quiz visibility change is not wired with the Premium withdrawal');
        return { success: false, error: 'Failed to update quiz', statusCode: 500 };
      }

      const updateData: UpdateQuizData = {
        ...(quizData.title !== undefined && { title: quizData.title }),
        ...(quizData.description !== undefined && { description: quizData.description }),
        ...(quizData.folder !== undefined && { folder: quizData.folder }),
        ...(quizData.questions !== undefined && {
          questions: quizData.questions.map(toQuizQuestionContent),
        }),
        ...(quizData.submitToPremium !== undefined && {
          visibility: quizData.submitToPremium ? ('personal' as const) : ('public' as const),
        }),
        ...(quizData.pdfUrl !== undefined && { pdfUrl: quizData.pdfUrl }),
      };
      // The stored quiz is read for the personal-data recheck, and for the
      // IndexNow before/after compare (RIN-1500) when a notifier is wired.
      const touchesSearch =
        touchesQuizContent(updateData) ||
        (updateData.visibility !== undefined && this.quizIndexNow !== undefined);
      const current = touchesSearch ? await this.quizRepository.findById(id) : null;
      if (touchesSearch && !current) {
        return { success: false, error: 'Quiz not found', statusCode: 404 };
      }
      if (current && touchesQuizContent(updateData)) {
        updateData.contentFlags = this.recheckContentFlags(current, updateData);
      }

      if (makesPublic && withdrawal) {
        const refusal = await makePublicWithdrawingSubmissions(withdrawal, id);
        if (refusal) return refusal;
      }

      const updatedQuiz = await this.quizRepository.update(id, updateData);

      if (!updatedQuiz) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404,
        };
      }

      if (current) notifyQuizSearchChange(this.quizIndexNow, current, updatedQuiz);

      return {
        success: true,
        data: QuizDetailDtoMapper.toDetail(updatedQuiz),
      };
    } catch (error) {
      logger.error({ error }, 'Update quiz error');
      return {
        success: false,
        error: 'Failed to update quiz',
        statusCode: 500,
      };
    }
  }

  /**
   * RIN-1338: re-runs the personal-data check when an edit touches the title,
   * description or questions, merging the unchanged texts from the stored quiz.
   */
  private recheckContentFlags(current: Quiz, updateData: UpdateQuizData): QuizContentFlags {
    const { title, description, questions } = updateData;
    return resolveQuizContentFlags(
      {
        title: title ?? current.title,
        description: description ?? current.description,
        questions: questions ?? current.questions,
      },
      current.contentFlags,
      new Date(),
    );
  }

  async deleteQuiz(
    id: string,
    userId: string,
    userRole?: string,
  ): Promise<ServiceResult<DeleteResultDto>> {
    try {
      const authorization = await this.authorizeQuizMutation(id, userId, userRole);
      if (!authorization.success) return authorization;

      const result = await this.quizRepository.delete(id);
      if (!result) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404,
        };
      }

      return {
        success: true,
        data: DeleteResultDtoMapper.toDto(id),
      };
    } catch (error) {
      logger.error({ error }, 'Delete quiz error');
      return {
        success: false,
        error: 'Failed to delete quiz',
        statusCode: 500,
      };
    }
  }
}
