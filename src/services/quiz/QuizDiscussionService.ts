import { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import { IDiscussionRepository } from '@/interfaces/repositories/IDiscussionRepository';
import { IReportRepository } from '@/interfaces/repositories/IReportRepository';
import { ServiceResult } from '@/interfaces/services/types';
import type { QuizDiscussionDto, ReportQuizResponseDto } from '@/dtos/quiz';
import type { Quiz } from '@/entities/Quiz';
import type { Session } from 'next-auth';
import { logger } from '@/lib/logger';
import { requireQuizReadAccess } from './quiz-helpers';
import { QuizDiscussionDtoMapper } from '@/mappers/quiz/QuizDiscussionDtoMapper';

export class QuizDiscussionService {
  constructor(
    private quizRepository: IQuizRepository,
    private discussionRepository: IDiscussionRepository,
    private reportRepository: IReportRepository,
  ) {}

  private async getAccessibleQuizSummary(
    slug: string,
    session?: Session | null,
  ): Promise<ServiceResult<Quiz>> {
    return requireQuizReadAccess(
      await this.quizRepository.findSummaryBySlug(slug),
      session?.user?.id,
      session?.user?.role,
    );
  }

  async getQuizDiscussions(
    slug: string,
    session?: Session | null,
  ): Promise<ServiceResult<QuizDiscussionDto[]>> {
    try {
      const access = await this.getAccessibleQuizSummary(slug, session);
      if (!access.success) return access;

      const allDiscussions = await this.discussionRepository.findByQuiz(access.data.id);

      return {
        success: true,
        data: allDiscussions.map(QuizDiscussionDtoMapper.toDto),
      };
    } catch (error) {
      logger.error({ error }, 'Get quiz discussions error');
      return {
        success: false,
        error: 'Failed to fetch discussions',
        statusCode: 500,
      };
    }
  }

  async addDiscussionComment(
    slug: string,
    questionIndex: number,
    content: string,
    session: Session | null,
  ): Promise<ServiceResult<QuizDiscussionDto>> {
    try {
      const authorId = session?.user?.id;
      if (!authorId) {
        return {
          success: false,
          error: 'Authentication required',
          statusCode: 401,
        };
      }

      const access = await this.getAccessibleQuizSummary(slug, session);
      if (!access.success) return access;

      const quiz = access.data;

      if (questionIndex < 0 || questionIndex >= (quiz.questionCount ?? 0)) {
        return {
          success: false,
          error: 'Invalid question index',
          statusCode: 400,
        };
      }

      const updatedDiscussion = await this.discussionRepository.addCommentForQuizQuestion(
        quiz.id,
        questionIndex,
        {
          authorId,
          content,
        },
      );

      if (!updatedDiscussion) {
        return {
          success: false,
          error: 'Failed to add comment',
          statusCode: 500,
        };
      }

      return {
        success: true,
        data: QuizDiscussionDtoMapper.toDto(updatedDiscussion),
      };
    } catch (error) {
      logger.error({ error }, 'Add discussion comment error');
      return {
        success: false,
        error: 'Failed to add comment',
        statusCode: 500,
      };
    }
  }

  async reportQuiz(
    slug: string,
    content: string,
    reporterEmail: string,
    reporterName: string,
    session?: Session | null,
  ): Promise<ServiceResult<ReportQuizResponseDto>> {
    try {
      const access = await this.getAccessibleQuizSummary(slug, session);
      if (!access.success) {
        return access;
      }
      const quiz = access.data;

      if (!content || content.trim().length === 0) {
        return {
          success: false,
          error: 'Report content is required',
          statusCode: 400,
        };
      }

      const report = await this.reportRepository.create({
        quizId: quiz.id,
        quizTitle: quiz.title,
        quizSlug: quiz.slug,
        reporterEmail,
        reporterName,
        content: content.trim(),
        status: 'pending',
      });

      return {
        success: true,
        data: QuizDiscussionDtoMapper.toReportResponseDto(report.id),
      };
    } catch (error) {
      logger.error({ error }, 'Report quiz error');
      return {
        success: false,
        error: 'Failed to report quiz',
        statusCode: 500,
      };
    }
  }
}
