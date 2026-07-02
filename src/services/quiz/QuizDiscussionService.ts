import { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import { IDiscussionRepository } from '@/interfaces/repositories/IDiscussionRepository';
import { IReportRepository } from '@/interfaces/repositories/IReportRepository';
import { ServiceResult } from '@/interfaces/services/types';
import type { QuizDiscussionDto, ReportQuizResponseDto } from '@/dtos/quiz';
import type { Session } from 'next-auth';
import { logger } from '@/lib/logger';
import { checkPrivateQuizAccess } from './quiz-helpers';
import { QuizDiscussionDtoMapper } from '@/mappers/quiz/QuizDiscussionDtoMapper';

export class QuizDiscussionService {
  constructor(
    private quizRepository: IQuizRepository,
    private userRepository: IUserRepository,
    private discussionRepository: IDiscussionRepository,
    private reportRepository: IReportRepository,
  ) {}

  async getQuizDiscussions(
    slug: string,
    session?: Session | null,
  ): Promise<ServiceResult<QuizDiscussionDto[]>> {
    try {
      const quiz = await this.quizRepository.findBySlug(slug);

      if (!quiz) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404,
        };
      }

      const userId = session?.user?.id;
      const userRole = session?.user?.role;
      const privateAccessError = await checkPrivateQuizAccess(quiz, userId, userRole);
      if (privateAccessError) return privateAccessError;

      const allDiscussions = await this.discussionRepository.ensureForQuizQuestions(
        quiz.id,
        quiz.questions.length,
      );

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
    userEmail: string,
    session?: Session | null,
  ): Promise<ServiceResult<QuizDiscussionDto>> {
    try {
      const quiz = await this.quizRepository.findBySlug(slug);

      if (!quiz) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404,
        };
      }

      const userId = session?.user?.id;
      const userRole = session?.user?.role;
      const privateAccessError = await checkPrivateQuizAccess(quiz, userId, userRole);
      if (privateAccessError) return privateAccessError;

      if (questionIndex < 0 || questionIndex >= quiz.questions.length) {
        return {
          success: false,
          error: 'Invalid question index',
          statusCode: 400,
        };
      }

      const user = await this.userRepository.findByEmail(userEmail);
      if (!user) {
        return {
          success: false,
          error: 'User not found',
          statusCode: 404,
        };
      }

      const existingDiscussion = await this.discussionRepository.ensureForQuizQuestion(
        quiz.id,
        questionIndex,
      );

      if (!existingDiscussion?.id) {
        return {
          success: false,
          error: 'Failed to create or find discussion',
          statusCode: 500,
        };
      }

      // Add comment to existing discussion
      const updatedDiscussion = await this.discussionRepository.addComment(existingDiscussion.id, {
        authorId: user.id,
        authorEmail: user.email,
        content,
      });

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
  ): Promise<ServiceResult<ReportQuizResponseDto>> {
    try {
      const quiz = await this.quizRepository.findBySlug(slug);

      if (!quiz) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404,
        };
      }

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

      if (!report) {
        return {
          success: false,
          error: 'Report not created',
          statusCode: 500,
        };
      }

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
