import {
  IQuizRepository,
  type QuizAccessRecord,
  type UpdateQuizData,
} from '@/interfaces/repositories/IQuizRepository';
import type { Quiz, QuizQuestionContent, QuizVisibility } from '@/entities/Quiz';
import type { IFolderRepository } from '@/interfaces/repositories/IFolderRepository';
import type { IPremiumQuizRepository } from '@/interfaces/repositories/IPremiumQuizRepository';
import type {
  CreateQuizRequestDto,
  QuizDetailDto,
  QuizMetadataDto,
  UpdateQuizRequestDto,
} from '@/dtos/quiz';
import { isNonIndexableQuizOwner } from '@/shared/constants/analytics-exclusions';
import { detectQuizContentLocale } from '@/lib/seo/quiz-indexability';
import type { DeleteResultDto } from '@/dtos/common';
import type { ServiceFailure, ServiceResult } from '@/interfaces/services/types';
import { generateSlug } from '@/lib/utils';
import { getAuthorId } from './quiz-helpers';
import { logger } from '@/lib/logger';
import { QuizCreationError } from '@/lib/quiz/errors';
import { isMongoDuplicateKeyError, isMongoDuplicateKeyErrorForField } from '@/lib/mongoose-errors';
import { QuizDetailDtoMapper } from '@/mappers/quiz/QuizDetailDtoMapper';
import { DeleteResultDtoMapper } from '@/mappers/common/DeleteResultDtoMapper';
import { QuizListDtoMapper } from '@/mappers/quiz/QuizListDtoMapper';
import { copyQuizQuestionContentFields } from '@/lib/quiz/question-fields';

const MAX_SLUG_CREATE_ATTEMPTS = 20;

function toQuizQuestionContent(
  question: CreateQuizRequestDto['questions'][number],
): QuizQuestionContent {
  const base = copyQuizQuestionContentFields(question);

  return question.type === 'single'
    ? { ...base, type: 'single', correctIndex: question.correctIndex }
    : { ...base, type: 'multiple', correctIndexes: question.correctIndexes };
}

/** The visibility fields shared by the create, update and draft-submit requests. */
interface VisibilityRequest {
  submitToPremium?: boolean | undefined;
  visibility?: QuizVisibility | undefined;
}

/**
 * RIN-1271: a learner's quiz is private (`personal`) unless the owner asks for
 * `public`; a Premium submission is always `personal`.
 */
function resolveRequestedVisibility(request: VisibilityRequest): QuizVisibility | undefined {
  return request.submitToPremium === true ? 'personal' : request.visibility;
}

type PremiumPublicationLookup = Pick<IPremiumQuizRepository, 'findActivePublicationByQuizId'>;

export class QuizCrudService {
  constructor(
    private quizRepository: IQuizRepository,
    private folderRepository?: IFolderRepository,
    private premiumPublications?: PremiumPublicationLookup,
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
    const { title, description, folderId, questions, pdfUrl } = quizData;

    if (folderId) {
      const ownsFolder = await this.folderRepository?.existsOwnedById(folderId, userId);
      if (!ownsFolder) {
        throw new QuizCreationError('invalid_folder', 'Invalid folder selected');
      }
    }

    const baseSlug = generateSlug(title);

    for (let attempt = 0; attempt < MAX_SLUG_CREATE_ATTEMPTS; attempt += 1) {
      const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`;

      try {
        return await this.quizRepository.create({
          title,
          ...(description !== undefined && { description }),
          slug,
          author: userId,
          folder: folderId ?? null,
          questions: questions.map(toQuizQuestionContent),
          visibility: resolveRequestedVisibility(quizData) ?? 'personal',
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

      const visibility = resolveRequestedVisibility(quizData);
      if (visibility === 'public') {
        const refusal = await this.refuseWhilePublished(id);
        if (refusal) return refusal;
      }

      const updateData: UpdateQuizData = {
        ...(quizData.title !== undefined && { title: quizData.title }),
        ...(quizData.description !== undefined && { description: quizData.description }),
        ...(quizData.folder !== undefined && { folder: quizData.folder }),
        ...(quizData.questions !== undefined && {
          questions: quizData.questions.map(toQuizQuestionContent),
        }),
        ...(visibility !== undefined && { visibility }),
        ...(quizData.pdfUrl !== undefined && { pdfUrl: quizData.pdfUrl }),
      };
      const updatedQuiz = await this.quizRepository.update(id, updateData);

      if (!updatedQuiz) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404,
        };
      }

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
   * Mirrors the admin rule (QuizAdminService.setQuizVisibility): a quiz with an
   * active Premium publication cannot be made public. Fails closed when the
   * lookup is not wired.
   */
  private async refuseWhilePublished(id: string): Promise<ServiceFailure | null> {
    if (!this.premiumPublications) {
      logger.error('Quiz visibility change is not wired with the Premium publication lookup');
      return { success: false, error: 'Failed to update quiz', statusCode: 500 };
    }
    const publication = await this.premiumPublications.findActivePublicationByQuizId(id);
    if (!publication) return null;
    return {
      success: false,
      code: 'conflict',
      error: 'A quiz with a premium publication cannot be made public',
      statusCode: 409,
    };
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
