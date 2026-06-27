import { IQuizRepository, IQuiz } from '@/interfaces/repositories/IQuizRepository';
import { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import { IAttemptRepository } from '@/interfaces/repositories/IAttemptRepository';
import { IQuizProgressRepository } from '@/interfaces/repositories/IQuizProgressRepository';
import { ServiceResult } from '@/interfaces/services/types';
import type { FlashcardCardDTO, FlashcardQuizDTO } from '@/interfaces/services/IQuizService';
import { createSubscriptionService } from '@/lib/subscription-factory';
import connectDB from '@/lib/mongoose';
import QuestionProgress from '@/models/QuestionProgress';
import UserProgress from '@/models/UserProgress';
import type { IQuestion } from '@/models/Quiz';
import type { Session } from 'next-auth';
import { getAuthorId, checkPrivateQuizAccess } from './quiz-helpers';
import { logger } from '@/lib/logger';

type Answer = number | number[];

function isAuthorMatch(quiz: IQuiz, userId: string): boolean {
  return getAuthorId(quiz.author) === userId;
}

export class QuizPlayService {
  constructor(
    private quizRepository: IQuizRepository,
    private userRepository: IUserRepository,
    private attemptRepository: IAttemptRepository,
    private quizProgressRepository?: IQuizProgressRepository,
  ) {}

  async getQuizForPlay(
    slug: string,
    userRole?: string,
    userId?: string,
  ): Promise<ServiceResult<IQuiz>> {
    try {
      const quiz = await this.quizRepository.findBySlug(slug);

      if (!quiz) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404,
        };
      }

      const authorId = getAuthorId(quiz.author);
      const isAuthor = !!userId && authorId === userId;
      const canAccessUnpublished = userRole === 'admin' || isAuthor;

      if (quiz.status !== 'published' && !canAccessUnpublished) {
        return {
          success: false,
          error: 'Quiz is not available',
          statusCode: 404,
        };
      }

      // Check permissions for private quizzes
      if (quiz.isPrivate) {
        if (!userId) {
          return {
            success: false,
            error: 'Authentication required to access private quiz',
            statusCode: 401,
          };
        }

        // Admin can access all private quizzes
        if (userRole === 'admin') {
          return { success: true, data: quiz };
        }

        // Author can access their own private quizzes
        if (authorId === userId) {
          return { success: true, data: quiz };
        }

        // Check if user has premium subscription
        const subscriptionService = createSubscriptionService();
        const isPremium = await subscriptionService.isUserPremium(userId);

        if (!isPremium) {
          return {
            success: false,
            error: 'Premium subscription required to access private quizzes',
            statusCode: 403,
          };
        }
      }

      // Return quiz without correct answers for playing
      const quizForPlay = {
        _id: quiz._id,
        title: quiz.title,
        description: quiz.description,
        author: quiz.author,
        slug: quiz.slug,
        status: quiz.status,
        isPrivate: quiz.isPrivate,
        createdAt: quiz.createdAt,
        updatedAt: quiz.updatedAt,
        questions: quiz.questions.map((q: IQuestion) => ({
          question: q.question,
          options: q.options,
          type: q.type,
          questionImage: q.questionImage,
          optionImages: q.optionImages,
        })),
      } as unknown as IQuiz;

      return { success: true, data: quizForPlay };
    } catch (error) {
      logger.error({ error }, 'Error in getQuizForPlay');
      return {
        success: false,
        error: 'Internal server error',
        statusCode: 500,
      };
    }
  }

  async submitQuizAttempt(
    slug: string,
    answers: Answer[],
    session: Session | null,
    userEmail?: string,
  ): Promise<
    ServiceResult<{
      score: number;
      correctAnswers: number;
      totalQuestions: number;
      attemptId: string;
    }>
  > {
    try {
      const quiz = await this.quizRepository.findBySlug(slug);

      if (!quiz || !quiz._id) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404,
        };
      }

      // Check access permission for unpublished quiz
      const authorId = getAuthorId(quiz.author);
      const userIdFromSession = session?.user?.id;
      const userRole = session?.user?.role;
      const canAccessUnpublished =
        userRole === 'admin' || (!!userIdFromSession && authorId === userIdFromSession);

      if (quiz.status !== 'published' && !canAccessUnpublished) {
        return {
          success: false,
          error: 'Quiz not found or not published',
          statusCode: 404,
        };
      }

      const privateAccessError = await checkPrivateQuizAccess(quiz, userIdFromSession, userRole);
      if (privateAccessError) return privateAccessError;

      // Get or create user
      let userId: string;
      if (session?.user?.email) {
        // Logged in user
        const user = await this.userRepository.findByEmail(session.user.email);
        if (!user) {
          return {
            success: false,
            error: 'User not found',
            statusCode: 404,
          };
        }
        userId = user._id.toString();
      } else if (userEmail) {
        // Non-logged in user with email - use email as identifier
        userId = userEmail;
      } else {
        return {
          success: false,
          error: 'User identification required',
          statusCode: 400,
        };
      }

      // Validate answers format
      if (!Array.isArray(answers) || answers.length !== quiz.questions.length) {
        return {
          success: false,
          error: 'Invalid answers format',
          statusCode: 400,
        };
      }

      // Format answers according to validation rules
      const formattedAnswers: Answer[] = answers.map((answer, index) => {
        const question = quiz.questions[index];
        if (!question) return -1;

        if (question.type === 'single') {
          // Single choice: -1 for unanswered, >= 0 for answered
          if (answer === -1) return -1;
          return typeof answer === 'number' && answer >= 0 ? answer : -1;
        } else if (question.type === 'multiple') {
          // Multiple choice: empty array for unanswered, array of >= 0 for answered
          if (!Array.isArray(answer) || answer.length === 0) {
            return [];
          }
          return answer.filter((a): a is number => typeof a === 'number' && a >= 0);
        }
        return answer;
      });

      // Calculate score
      let correctAnswers = 0;
      const totalQuestions = quiz.questions.length;

      for (let i = 0; i < totalQuestions; i++) {
        const question = quiz.questions[i];
        if (!question) continue;
        const userAnswer = formattedAnswers[i];

        if (question.type === 'single') {
          if (userAnswer === question.correctIndex) {
            correctAnswers++;
          }
        } else if (question.type === 'multiple') {
          const userAnswers = Array.isArray(userAnswer) ? userAnswer.toSorted() : [];
          const correctAnswers_q = Array.isArray(question.correctIndexes)
            ? question.correctIndexes.toSorted()
            : [];

          if (JSON.stringify(userAnswers) === JSON.stringify(correctAnswers_q)) {
            correctAnswers++;
          }
        }
      }

      const score = Math.round((correctAnswers / totalQuestions) * 100);

      // Save attempt
      const attempt = await this.attemptRepository.create({
        user: userId,
        quiz: quiz._id,
        answers: formattedAnswers,
        score,
        totalQuestions,
        takenAt: new Date(),
      });

      // === Update gamification stats (logged-in users only) ===
      if (session?.user?.email) {
        await connectDB();

        // 1. Create QuestionProgress for WRONG answers (add to review queue)
        const wrongQuestions: Array<{
          index: number;
          question: IQuestion;
          userAnswer: Answer;
        }> = [];

        for (let i = 0; i < totalQuestions; i++) {
          const question = quiz.questions[i];
          if (!question) continue;
          const userAnswer = formattedAnswers[i] ?? -1;
          let isCorrect = false;

          if (question.type === 'single') {
            isCorrect = userAnswer === question.correctIndex;
          } else if (question.type === 'multiple') {
            const userAnswers = Array.isArray(userAnswer) ? userAnswer.toSorted() : [];
            const correctAnswers_q = Array.isArray(question.correctIndexes)
              ? question.correctIndexes.toSorted()
              : [];
            isCorrect = JSON.stringify(userAnswers) === JSON.stringify(correctAnswers_q);
          }

          if (!isCorrect) {
            wrongQuestions.push({ index: i, question, userAnswer });
          }
        }

        // Create QuestionProgress for each wrong answer
        await Promise.all(
          wrongQuestions.map(async (wrong) => {
            const questionId =
              (wrong.question as { _id?: { toString(): string } })._id?.toString() ||
              `${slug}-q${wrong.index}`;

            // Check if already exists
            const existing = await QuestionProgress.findOne({
              userId,
              quizSlug: slug,
              questionId,
            });

            if (existing) {
              return;
            }

            // Create new QuestionProgress - due immediately for review
            await QuestionProgress.create({
              userId,
              quizSlug: slug,
              questionId,
              questionRef: {
                text: wrong.question.question || (wrong.question as { text?: string }).text || '',
                options: wrong.question.options || [],
                correctIndexes:
                  wrong.question.type === 'single'
                    ? [wrong.question.correctIndex]
                    : wrong.question.correctIndexes || [],
              },
              srsLevel: 0,
              interval: 0,
              easeFactor: 2.5,
              nextReviewDate: new Date(), // Due immediately
              lastReviewDate: null,
              correctStreak: 0,
              totalReviews: 0,
              totalCorrect: 0,
              history: [],
            });
          }),
        );

        // 2. Update UserProgress
        let uProgress = await UserProgress.findOne({ userId });

        if (!uProgress) {
          uProgress = new UserProgress({ userId });
        }

        // Award XP: 10 XP per correct answer
        const xpGain = correctAnswers * 10;
        uProgress.totalXp += xpGain;

        // Increment totalQuizzesTaken
        uProgress.totalQuizzesTaken += 1;

        // Update streak logic
        const now = new Date();
        const lastActive = uProgress.lastActiveDate ? new Date(uProgress.lastActiveDate) : null;
        const todayStr = now.toISOString().split('T')[0] ?? '';
        const lastActiveStr = lastActive ? lastActive.toISOString().split('T')[0] : null;

        if (todayStr !== lastActiveStr) {
          if (lastActiveStr) {
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            if (lastActiveStr === yesterdayStr) {
              // Continue streak
              uProgress.currentStreak += 1;
            } else {
              // Check for streak freeze
              const twoDaysAgo = new Date(now);
              twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
              const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];

              if (lastActiveStr === twoDaysAgoStr && uProgress.streakFreezeCount > 0) {
                uProgress.streakFreezeCount -= 1;
                uProgress.currentStreak += 1;
              } else {
                // Reset streak
                uProgress.currentStreak = 1;
              }
            }
          } else {
            // First activity ever
            uProgress.currentStreak = 1;
          }

          uProgress.lastActiveDate = now;

          if (uProgress.currentStreak > uProgress.longestStreak) {
            uProgress.longestStreak = uProgress.currentStreak;
          }
        }

        // Update weekly activity
        if (!uProgress.weeklyActivity) {
          uProgress.weeklyActivity = new Map();
        }

        const activityKey = todayStr;
        const currentActivity = uProgress.weeklyActivity.get(activityKey) || {
          questionsReviewed: 0,
          xpEarned: 0,
          correctCount: 0,
          totalCount: 0,
        };

        currentActivity.questionsReviewed += totalQuestions;
        currentActivity.xpEarned += xpGain;
        currentActivity.correctCount += correctAnswers;
        currentActivity.totalCount += totalQuestions;

        uProgress.weeklyActivity.set(activityKey, currentActivity);

        // Update 7-day accuracy
        const last7Days: string[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const key = d.toISOString().split('T')[0];
          if (key) last7Days.push(key);
        }

        let totalCorrectWeek = 0;
        let totalQuestionsWeek = 0;
        for (const dayKey of last7Days) {
          const dayActivity = uProgress.weeklyActivity.get(dayKey);
          if (dayActivity) {
            totalCorrectWeek += dayActivity.correctCount || 0;
            totalQuestionsWeek += dayActivity.totalCount || 0;
          }
        }

        uProgress.averageAccuracy =
          totalQuestionsWeek > 0 ? Math.round((totalCorrectWeek / totalQuestionsWeek) * 100) : 0;

        await uProgress.save();

        // Clear any saved in-progress state now that the attempt is submitted.
        if (this.quizProgressRepository && quiz._id) {
          try {
            await this.quizProgressRepository.deleteByUserAndQuiz(userId, String(quiz._id));
          } catch (error) {
            logger.warn({ error }, 'Failed to clear quiz progress after submit');
          }
        }
      }

      return {
        success: true,
        data: {
          score,
          correctAnswers,
          totalQuestions,
          attemptId: String(attempt._id),
        },
      };
    } catch (error) {
      logger.error({ error }, 'Submit quiz attempt error');
      return {
        success: false,
        error: 'Failed to submit quiz attempt',
        statusCode: 500,
      };
    }
  }

  async getQuizFlashcards(
    slug: string,
    session?: Session | null,
  ): Promise<ServiceResult<FlashcardQuizDTO>> {
    try {
      const quiz = await this.quizRepository.findBySlug(slug);

      if (!quiz) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404,
        };
      }

      const isAdmin = session?.user?.role === 'admin';
      const isAuthor = !!session?.user?.id && isAuthorMatch(quiz, session.user.id);

      if (quiz.status !== 'published' && !isAdmin && !isAuthor) {
        return {
          success: false,
          error: 'Quiz not found or not published',
          statusCode: 404,
        };
      }

      // Check if quiz is private and user has access
      if (quiz.isPrivate && session?.user) {
        if (!isAdmin && !isAuthor) {
          // Check if user has premium subscription
          const subscriptionService = createSubscriptionService();
          const isPremium = await subscriptionService.isUserPremium(session.user.id);

          if (!isPremium) {
            return {
              success: false,
              error: 'Premium subscription required to access private quizzes',
              statusCode: 403,
            };
          }
        }
      }

      const cards: FlashcardCardDTO[] = quiz.questions.map((q: IQuestion) => ({
        question: q.question,
        answer:
          q.type === 'single'
            ? (q.options[q.correctIndex ?? -1] ?? '')
            : (q.correctIndexes ?? []).map((idx) => q.options[idx] ?? '').join(', '),
        questionImage: q.questionImage,
        optionImages: q.optionImages,
      }));

      return {
        success: true,
        data: {
          _id: String(quiz._id),
          title: quiz.title,
          description: quiz.description,
          cards,
        },
      };
    } catch (error) {
      logger.error({ error }, 'Get quiz flashcards error');
      return {
        success: false,
        error: 'Failed to get quiz flashcards',
        statusCode: 500,
      };
    }
  }

  async getQuizForFlashcards(
    slug: string,
    session: Session | null,
  ): Promise<ServiceResult<FlashcardQuizDTO>> {
    try {
      const quiz = await this.quizRepository.findBySlug(slug);

      if (!quiz) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404,
        };
      }

      const isAdmin = session?.user?.role === 'admin';
      const isAuthor = !!session?.user?.id && isAuthorMatch(quiz, session.user.id);

      if (quiz.status !== 'published' && !isAdmin && !isAuthor) {
        return {
          success: false,
          error: 'Quiz not found or not published',
          statusCode: 404,
        };
      }

      // Check if quiz is private and user has access
      if (quiz.isPrivate) {
        if (!session?.user) {
          return {
            success: false,
            error: 'Access denied. This quiz is private.',
            statusCode: 403,
          };
        }

        if (!isAdmin && !isAuthor) {
          // Check if user has premium subscription
          const subscriptionService = createSubscriptionService();
          const isPremium = await subscriptionService.isUserPremium(session.user.id);

          if (!isPremium) {
            return {
              success: false,
              error: 'Premium subscription required to access private quizzes',
              statusCode: 403,
            };
          }
        }
      }

      const cards: FlashcardCardDTO[] = quiz.questions.map((q: IQuestion) => ({
        question: q.question,
        answer:
          q.type === 'single'
            ? (q.options[q.correctIndex ?? -1] ?? '')
            : (q.correctIndexes ?? []).map((idx) => q.options[idx] ?? '').join(', '),
        questionImage: q.questionImage,
        optionImages: q.optionImages,
      }));

      return {
        success: true,
        data: {
          _id: String(quiz._id),
          title: quiz.title,
          description: quiz.description,
          cards,
        },
      };
    } catch (error) {
      logger.error({ error }, 'Get quiz for flashcards error');
      return {
        success: false,
        error: 'Failed to get quiz for flashcards',
        statusCode: 500,
      };
    }
  }
}
