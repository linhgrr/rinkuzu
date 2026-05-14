import { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import { IAttemptRepository } from '@/interfaces/repositories/IAttemptRepository';
import { ServiceResult } from '@/interfaces/services/types';
import { ServiceFactory } from '@/lib/serviceFactory';
import connectDB from '@/lib/mongoose';
import QuestionProgress from '@/models/QuestionProgress';
import UserProgress from '@/models/UserProgress';
import { getAuthorId, checkPrivateQuizAccess } from './quiz-helpers';

export class QuizPlayService {
  constructor(
    private quizRepository: IQuizRepository,
    private userRepository: IUserRepository,
    private attemptRepository: IAttemptRepository,
  ) {}

  async getQuizForPlay(slug: string, userRole?: string, userId?: string): Promise<any> {
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
        const subscriptionService = ServiceFactory.createSubscriptionService();
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
        category: quiz.category,
        status: quiz.status,
        isPrivate: quiz.isPrivate,
        createdAt: quiz.createdAt,
        updatedAt: quiz.updatedAt,
        questions: quiz.questions.map((q: any) => ({
          question: q.question,
          options: q.options,
          type: q.type,
          questionImage: q.questionImage,
          optionImages: q.optionImages,
        })),
      };

      return { success: true, data: quizForPlay };
    } catch (error) {
      console.error('Error in getQuizForPlay:', error);
      return {
        success: false,
        error: 'Internal server error',
        statusCode: 500,
      };
    }
  }

  async submitQuizAttempt(
    slug: string,
    answers: any[],
    session: any,
    userEmail?: string,
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
      const formattedAnswers = answers.map((answer, index) => {
        const question = quiz.questions[index];

        if (question.type === 'single') {
          // Single choice: -1 for unanswered, >= 0 for answered
          return answer === -1 ? -1 : typeof answer === 'number' && answer >= 0 ? answer : -1;
        } else if (question.type === 'multiple') {
          // Multiple choice: empty array for unanswered, array of >= 0 for answered
          if (!Array.isArray(answer) || answer.length === 0) {
            return [];
          }
          return answer.filter((a) => typeof a === 'number' && a >= 0);
        }
        return answer;
      });

      // Calculate score
      let correctAnswers = 0;
      const totalQuestions = quiz.questions.length;

      for (let i = 0; i < totalQuestions; i++) {
        const question = quiz.questions[i];
        const userAnswer = formattedAnswers[i];

        if (question.type === 'single') {
          if (userAnswer === question.correctIndex) {
            correctAnswers++;
          }
        } else if (question.type === 'multiple') {
          const userAnswers = Array.isArray(userAnswer) ? userAnswer.sort() : [];
          const correctAnswers_q = Array.isArray(question.correctIndexes)
            ? question.correctIndexes.sort()
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

      // === NEW: Update gamification stats ===

      // Only update stats for logged-in users (not anonymous)
      if (session?.user?.email) {
        await connectDB();

        // 1. Create QuestionProgress for WRONG answers (add to review queue)
        const wrongQuestions: Array<{
          index: number;
          question: any;
          userAnswer: any;
        }> = [];

        for (let i = 0; i < totalQuestions; i++) {
          const question = quiz.questions[i];
          const userAnswer = formattedAnswers[i];
          let isCorrect = false;

          if (question.type === 'single') {
            isCorrect = userAnswer === question.correctIndex;
          } else if (question.type === 'multiple') {
            const userAnswers = Array.isArray(userAnswer) ? userAnswer.sort() : [];
            const correctAnswers_q = Array.isArray(question.correctIndexes)
              ? question.correctIndexes.sort()
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
            const questionId = wrong.question._id?.toString() || `${slug}-q${wrong.index}`;

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
                text: wrong.question.question || wrong.question.text || '',
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
        const todayStr = now.toISOString().split('T')[0];
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
          last7Days.push(d.toISOString().split('T')[0]);
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
      }

      // === END: Update gamification stats ===

      return {
        success: true,
        data: {
          score,
          correctAnswers,
          totalQuestions,
          attemptId: attempt._id,
        },
      };
    } catch (error: any) {
      console.error('Submit quiz attempt error:', error);
      return {
        success: false,
        error: 'Failed to submit quiz attempt',
        statusCode: 500,
      };
    }
  }

  async getQuizFlashcards(slug: string, session?: any): Promise<any> {
    const quiz = await this.quizRepository.findBySlug(slug);

    if (!quiz) {
      throw new Error('Quiz not found');
    }

    const isAdmin = session?.user?.role === 'admin';
    const isAuthor =
      !!session?.user?.id &&
      ((quiz.author as any)?._id
        ? (quiz.author as any)._id.toString() === session.user.id
        : quiz.author === session.user.id);

    if (quiz.status !== 'published' && !isAdmin && !isAuthor) {
      throw new Error('Quiz not found or not published');
    }

    // Check if quiz is private and user has access
    if (quiz.isPrivate && session?.user) {
      if (!isAdmin && !isAuthor) {
        // Check if user has premium subscription
        const subscriptionService = ServiceFactory.createSubscriptionService();
        const isPremium = await subscriptionService.isUserPremium((session.user as any).id);

        if (!isPremium) {
          throw new Error('Premium subscription required to access private quizzes');
        }
      }
    }

    const flashcards = quiz.questions.map((q: any, index: number) => ({
      id: index,
      question: q.question,
      answer:
        q.type === 'single'
          ? q.options[q.correctIndex]
          : q.correctIndexes.map((idx: number) => q.options[idx]).join(', '),
      type: q.type,
      questionImage: q.questionImage || null,
      optionImages: q.optionImages || [],
    }));

    return {
      _id: quiz._id,
      title: quiz.title,
      description: quiz.description,
      slug: quiz.slug,
      flashcards,
    };
  }

  async getQuizForFlashcards(slug: string, session: any): Promise<ServiceResult<any>> {
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
      const isAuthor =
        !!session?.user?.id &&
        ((quiz.author as any)?._id
          ? (quiz.author as any)._id.toString() === session.user.id
          : quiz.author === session.user.id);

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
          const subscriptionService = ServiceFactory.createSubscriptionService();
          const isPremium = await subscriptionService.isUserPremium((session.user as any).id);

          if (!isPremium) {
            return {
              success: false,
              error: 'Premium subscription required to access private quizzes',
              statusCode: 403,
            };
          }
        }
      }

      // Return quiz with correct answers for flashcards
      const flashcardQuiz = {
        _id: quiz._id,
        title: quiz.title,
        description: quiz.description,
        author: quiz.author,
        slug: quiz.slug,
        questions: quiz.questions.map((q: any) => ({
          question: q.question,
          options: q.options,
          type: q.type,
          correctIndex: q.correctIndex,
          correctIndexes: q.correctIndexes,
        })),
        createdAt: quiz.createdAt,
      };

      return {
        success: true,
        data: flashcardQuiz,
      };
    } catch (error) {
      console.error('Get quiz for flashcards error:', error);
      return {
        success: false,
        error: 'Failed to get quiz for flashcards',
        statusCode: 500,
      };
    }
  }
}
