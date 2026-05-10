import { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import { IDiscussionRepository } from '@/interfaces/repositories/IDiscussionRepository';
import { IReportRepository } from '@/interfaces/repositories/IReportRepository';
import { ServiceResult } from '@/interfaces/services/types';
import { getAuthorId, checkPrivateQuizAccess } from './quiz-helpers';

export class QuizDiscussionService {
  constructor(
    private quizRepository: IQuizRepository,
    private userRepository: IUserRepository,
    private discussionRepository: IDiscussionRepository,
    private reportRepository: IReportRepository,
  ) {}

  async getQuizDiscussions(slug: string, session?: any): Promise<ServiceResult<any[]>> {
    try {
      const quiz = await this.quizRepository.findBySlug(slug);

      if (!quiz || !quiz._id) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404,
        };
      }

      const authorId = getAuthorId(quiz.author);
      const userId = session?.user?.id;
      const userRole = session?.user?.role;
      const canAccessUnpublished = userRole === 'admin' || (!!userId && authorId === userId);

      if (quiz.status !== 'published' && !canAccessUnpublished) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404,
        };
      }

      const privateAccessError = await checkPrivateQuizAccess(quiz, userId, userRole);
      if (privateAccessError) return privateAccessError;

      const existingDiscussions = await this.discussionRepository.findByQuiz(quiz._id.toString());
      const discussionOwnerId = authorId;

      if (!discussionOwnerId) {
        return {
          success: false,
          error: 'Quiz author not found',
          statusCode: 500,
        };
      }

      // Create discussions for all questions if they don't exist
      const allDiscussions = [];
      for (let i = 0; i < quiz.questions.length; i++) {
        const existingDiscussion = existingDiscussions.find((d) => d.questionIndex === i);

        if (existingDiscussion) {
          allDiscussions.push(existingDiscussion);
        } else {
          // Create empty discussion for this question
          const newDiscussion = await this.discussionRepository.create({
            quiz: quiz._id.toString(),
            user: discussionOwnerId,
            questionIndex: i,
            content: `Discussion for question ${i + 1}`,
            comments: [],
          });
          allDiscussions.push(newDiscussion);
        }
      }

      return {
        success: true,
        data: allDiscussions,
      };
    } catch (error) {
      console.error('Get quiz discussions error:', error);
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
    session?: any,
  ): Promise<ServiceResult<any>> {
    try {
      const quiz = await this.quizRepository.findBySlug(slug);

      if (!quiz || !quiz._id) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404,
        };
      }

      const authorId = getAuthorId(quiz.author);
      const userId = session?.user?.id;
      const userRole = session?.user?.role;
      const canAccessUnpublished = userRole === 'admin' || (!!userId && authorId === userId);

      if (quiz.status !== 'published' && !canAccessUnpublished) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404,
        };
      }

      const privateAccessError = await checkPrivateQuizAccess(quiz, userId, userRole);
      if (privateAccessError) return privateAccessError;

      if (questionIndex < 0 || questionIndex >= quiz.questions.length) {
        return {
          success: false,
          error: 'Invalid question index',
          statusCode: 400,
        };
      }

      const discussionOwnerId = authorId;
      if (!discussionOwnerId) {
        return {
          success: false,
          error: 'Quiz author not found',
          statusCode: 500,
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

      // Find or create discussion for this question
      let discussions = await this.discussionRepository.findByQuiz(quiz._id.toString());
      let existingDiscussion = discussions.find((d) => d.questionIndex === questionIndex);

      if (!existingDiscussion) {
        // Create new discussion for this question
        existingDiscussion = await this.discussionRepository.create({
          quiz: quiz._id.toString(),
          user: discussionOwnerId,
          questionIndex,
          content: `Discussion for question ${questionIndex + 1}`,
          comments: [],
        });
      }

      if (!existingDiscussion || !existingDiscussion._id) {
        return {
          success: false,
          error: 'Failed to create or find discussion',
          statusCode: 500,
        };
      }

      // Add comment to existing discussion
      const commentData = {
        author: user._id,
        authorEmail: user.email,
        content,
        isEdited: false,
        createdAt: new Date(),
      };

      const updatedDiscussion = await this.discussionRepository.update(
        existingDiscussion._id.toString(),
        {
          comments: [...(existingDiscussion.comments || []), commentData],
        },
      );

      return {
        success: true,
        data: updatedDiscussion,
      };
    } catch (error) {
      console.error('Add discussion comment error:', error);
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
  ): Promise<ServiceResult<string>> {
    try {
      const quiz = await this.quizRepository.findBySlug(slug);

      if (!quiz || !quiz._id) {
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
        quiz: quiz._id.toString(),
        reporter: reporterEmail,
        reason: content.trim(),
        description: reporterName,
        status: 'pending',
      });

      if (!report || !report._id) {
        return {
          success: false,
          error: 'Report not created',
          statusCode: 500,
        };
      }

      return {
        success: true,
        data: report._id.toString(),
      };
    } catch (error) {
      console.error('Report quiz error:', error);
      return {
        success: false,
        error: 'Failed to report quiz',
        statusCode: 500,
      };
    }
  }
}
