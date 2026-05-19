import { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import {
  IDiscussionRepository,
  type IDiscussion,
} from '@/interfaces/repositories/IDiscussionRepository';
import { IReportRepository } from '@/interfaces/repositories/IReportRepository';
import { ServiceResult } from '@/interfaces/services/types';
import type { DiscussionCommentDTO, QuizDiscussionDTO } from '@/interfaces/services/IQuizService';
import type { IUserPreview } from '@/types/index';
import type { Session } from 'next-auth';
import { getAuthorId, checkPrivateQuizAccess } from './quiz-helpers';

function isPopulatedAuthor(author: string | IUserPreview): author is IUserPreview {
  return typeof author === 'object' && author !== null && '_id' in author;
}

function toCommentDTO(comment: NonNullable<IDiscussion['comments']>[number]): DiscussionCommentDTO {
  if (isPopulatedAuthor(comment.author)) {
    return {
      authorId: String(comment.author._id),
      authorEmail: comment.authorEmail,
      authorName: comment.author.displayName ?? comment.author.name,
      authorAvatar: comment.author.avatar,
      content: comment.content,
      isEdited: comment.isEdited,
      createdAt: comment.createdAt,
    };
  }
  return {
    authorId: comment.author,
    authorEmail: comment.authorEmail,
    content: comment.content,
    isEdited: comment.isEdited,
    createdAt: comment.createdAt,
  };
}

function toDiscussionDTO(discussion: IDiscussion): QuizDiscussionDTO {
  return {
    _id: String(discussion._id),
    questionIndex: discussion.questionIndex,
    content: discussion.content,
    ownerId: discussion.user,
    comments: (discussion.comments ?? []).map(toCommentDTO),
    createdAt: discussion.createdAt,
    updatedAt: discussion.updatedAt,
  };
}

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
  ): Promise<ServiceResult<QuizDiscussionDTO[]>> {
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

      const quizId = quiz._id.toString();

      // Create discussions for all questions if they don't exist
      const existingDiscussionByIndex = new Map(
        existingDiscussions.map((discussion) => [discussion.questionIndex, discussion]),
      );
      const allDiscussions = await Promise.all(
        quiz.questions.map((_, index) => {
          const existingDiscussion = existingDiscussionByIndex.get(index);
          if (existingDiscussion) {
            return existingDiscussion;
          }

          return this.discussionRepository.create({
            quiz: quizId,
            user: discussionOwnerId,
            questionIndex: index,
            content: `Discussion for question ${index + 1}`,
            comments: [],
          });
        }),
      );

      return {
        success: true,
        data: allDiscussions.map(toDiscussionDTO),
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
    session?: Session | null,
  ): Promise<ServiceResult<QuizDiscussionDTO>> {
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

      if (!updatedDiscussion) {
        return {
          success: false,
          error: 'Failed to add comment',
          statusCode: 500,
        };
      }

      return {
        success: true,
        data: toDiscussionDTO(updatedDiscussion),
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
