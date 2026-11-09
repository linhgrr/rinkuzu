import { IQuizRepository, type QuizFindFilter } from '@/interfaces/repositories/IQuizRepository';
import type { IAdminAuditRepository } from '@/interfaces/repositories/IAdminAuditRepository';
import type { IPremiumQuizRepository } from '@/interfaces/repositories/IPremiumQuizRepository';
import { ServiceResult } from '@/interfaces/services/types';
import type { QuizVisibility } from '@/entities/Quiz';
import type {
  AdminQuizDetailDto,
  AdminQuizListDto,
  AdminQuizListQueryDto,
  AdminQuizVisibilityChangeDto,
} from '@/dtos/admin-quiz';
import type { DeleteResultDto } from '@/dtos/common';
import type { PublicQuizSitemapEntryDto, QuizListDto, QuizListOptionsDto } from '@/dtos/quiz';
import { isNonIndexableQuizOwner } from '@/shared/constants/analytics-exclusions';
import { detectQuizContentLocale, isQuizIndexable } from '@/lib/seo/quiz-indexability';
import { logger } from '@/lib/logger';
import { AdminQuizDtoMapper } from '@/mappers/quiz/AdminQuizDtoMapper';
import { DeleteResultDtoMapper } from '@/mappers/common/DeleteResultDtoMapper';
import { QuizListDtoMapper } from '@/mappers/quiz/QuizListDtoMapper';

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyQuizSearchFilter(filter: QuizFindFilter, search?: string): void {
  const normalizedSearch = search?.trim();
  if (!normalizedSearch) return;

  const searchRegex = new RegExp(escapeRegexLiteral(normalizedSearch), 'i');
  filter.$or = [{ title: searchRegex }, { description: searchRegex }];
}

export interface QuizAdminActor {
  id: string;
  email: string;
}

/**
 * What an admin visibility change needs beyond the quiz repository. Optional so
 * read-only callers (QuizService) need not wire them; the visibility change
 * fails closed without them.
 */
export interface QuizAdminVisibilityDeps {
  premiumRepository: Pick<IPremiumQuizRepository, 'findActivePublicationByQuizId'>;
  auditRepository: IAdminAuditRepository;
}

export class QuizAdminService {
  constructor(
    private quizRepository: IQuizRepository,
    private visibilityDeps?: QuizAdminVisibilityDeps,
  ) {}

  async listAdminQuizzes(query: AdminQuizListQueryDto): Promise<ServiceResult<AdminQuizListDto>> {
    try {
      const { search, visibility, page, limit } = query;
      const filter: QuizFindFilter = {};

      if (visibility !== 'all') {
        filter.visibility = visibility;
      }

      applyQuizSearchFilter(filter, search);

      const result = await this.quizRepository.findAll(filter, {
        page,
        limit,
        sort: { createdAt: -1 },
      });

      return {
        success: true,
        data: AdminQuizDtoMapper.toListDto(result.items, result.pagination),
      };
    } catch (error) {
      logger.error({ error }, 'List admin quizzes error');
      return {
        success: false,
        error: 'Failed to list quizzes',
        statusCode: 500,
      };
    }
  }

  async getAdminQuiz(id: string): Promise<ServiceResult<AdminQuizDetailDto>> {
    try {
      const quiz = await this.quizRepository.findById(id);
      if (!quiz) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404,
        };
      }

      return { success: true, data: AdminQuizDtoMapper.toDetail(quiz) };
    } catch (error) {
      logger.error({ error }, 'Get admin quiz error');
      return {
        success: false,
        error: 'Failed to get quiz',
        statusCode: 500,
      };
    }
  }

  async deleteAdminQuiz(id: string): Promise<ServiceResult<DeleteResultDto>> {
    try {
      const quiz = await this.quizRepository.findAccessById(id);
      if (!quiz) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404,
        };
      }

      const deleted = await this.quizRepository.delete(id);
      if (!deleted) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404,
        };
      }

      return { success: true, data: DeleteResultDtoMapper.toDto(id) };
    } catch (error) {
      logger.error({ error }, 'Delete admin quiz error');
      return {
        success: false,
        error: 'Failed to delete quiz',
        statusCode: 500,
      };
    }
  }

  /**
   * Admin moderation: hide a public quiz (`personal`) or publish it again.
   *
   * Every real change is audited. The audit write is fail-closed: if it throws,
   * the visibility is put back and the call fails, so no change goes unrecorded.
   * Making a quiz with an active premium publication public is refused, because
   * that would hand out paid content for free.
   */
  async setAdminQuizVisibility(
    id: string,
    visibility: QuizVisibility,
    actor: QuizAdminActor,
  ): Promise<ServiceResult<AdminQuizVisibilityChangeDto>> {
    if (!this.visibilityDeps) {
      logger.error('Admin quiz visibility change is not wired with audit dependencies');
      return {
        success: false,
        code: 'internal_error',
        error: 'Failed to change quiz visibility',
        statusCode: 500,
      };
    }
    const { premiumRepository, auditRepository } = this.visibilityDeps;

    try {
      const quiz = await this.quizRepository.findById(id);
      if (!quiz) {
        return { success: false, code: 'not_found', error: 'Quiz not found', statusCode: 404 };
      }

      const from = quiz.visibility;
      if (from === visibility) {
        return {
          success: true,
          data: AdminQuizDtoMapper.toVisibilityChange(quiz, visibility, false),
        };
      }

      if (visibility === 'public') {
        const publication = await premiumRepository.findActivePublicationByQuizId(quiz.id);
        if (publication) {
          return {
            success: false,
            code: 'conflict',
            error: 'A quiz with a premium publication cannot be made public',
            statusCode: 409,
          };
        }
      }

      const updated = await this.quizRepository.update(quiz.id, { visibility });
      if (!updated) {
        return { success: false, code: 'not_found', error: 'Quiz not found', statusCode: 404 };
      }

      try {
        await auditRepository.record({
          actorId: actor.id,
          actorEmail: actor.email,
          action: 'quiz.visibility.changed',
          entityType: 'quiz',
          entityId: quiz.id,
          details: { slug: quiz.slug, from, to: visibility },
        });
      } catch (auditError) {
        logger.error(
          { error: auditError, quizId: quiz.id },
          'Quiz visibility audit write failed; reverting the change',
        );
        await this.quizRepository.update(quiz.id, { visibility: from });
        return {
          success: false,
          code: 'internal_error',
          error: 'Failed to change quiz visibility',
          statusCode: 500,
        };
      }

      return {
        success: true,
        data: AdminQuizDtoMapper.toVisibilityChange(quiz, visibility, true),
      };
    } catch (error) {
      logger.error({ error, quizId: id }, 'Set admin quiz visibility error');
      return {
        success: false,
        code: 'internal_error',
        error: 'Failed to change quiz visibility',
        statusCode: 500,
      };
    }
  }

  /**
   * Newest indexable public quizzes for the sitemap (RIN-1241 D13): owners that
   * are test or company accounts (RIN-840) and quizzes under 5 questions are
   * excluded in the query, so the limit counts only indexable quizzes. Each
   * carries its content locale, the one URL the sitemap lists (D14).
   */
  async getPublicSitemapQuizzes(limit: number): Promise<PublicQuizSitemapEntryDto[]> {
    const candidates = await this.quizRepository.findNonIndexableOwnerCandidates();
    const excludeAuthorIds = candidates
      .filter((owner) => isNonIndexableQuizOwner(owner))
      .map((owner) => owner.id);
    const rows = await this.quizRepository.findPublicSitemapEntries({ excludeAuthorIds, limit });
    return rows
      .filter((row) =>
        isQuizIndexable({
          visibility: 'public',
          ownerIndexable: true,
          questionCount: row.questionCount,
        }),
      )
      .map((row) => ({
        slug: row.slug,
        contentLocale: detectQuizContentLocale(row.title, row.leadQuestionTexts),
        createdAt: row.createdAt.toISOString(),
        ...(row.updatedAt ? { updatedAt: row.updatedAt.toISOString() } : {}),
      }));
  }

  async getQuizzes(options: QuizListOptionsDto): Promise<QuizListDto> {
    const { search, folder, page, limit, visibility, userId, onlyMine } = options;

    const filter: QuizFindFilter = {};

    if (onlyMine) {
      if (visibility !== undefined) filter.visibility = visibility;
    } else {
      filter.visibility = 'public';
    }

    // If caller wants only their own quizzes
    if (onlyMine && userId) {
      filter.author = userId;
    }

    if (onlyMine && folder !== undefined) {
      filter.folder = folder;
    }

    applyQuizSearchFilter(filter, search);

    const result = await this.quizRepository.findAll(filter, {
      page,
      limit,
      sort: { createdAt: -1 },
    });
    return {
      quizzes: result.items.map(QuizListDtoMapper.toListItem),
      pagination: result.pagination,
    };
  }
}
