import { IQuiz } from '@/interfaces/repositories/IQuizRepository';
import { ServiceResult } from '@/interfaces/services/types';
import { ServiceFactory } from '@/lib/serviceFactory';

export function getAuthorId(author: IQuiz['author'] | undefined): string | undefined {
  if (!author) return undefined;
  if (typeof author === 'string') return author;
  if (typeof author === 'object' && '_id' in author && author._id) {
    return author._id.toString();
  }
  return undefined;
}

export async function checkPrivateQuizAccess(
  quiz: IQuiz,
  userId?: string,
  userRole?: string,
): Promise<ServiceResult<never> | null> {
  if (!quiz.isPrivate) return null;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required to access private quiz',
      statusCode: 401,
    };
  }

  const authorId = getAuthorId(quiz.author);
  if (userRole === 'admin' || authorId === userId) return null;

  const subscriptionService = ServiceFactory.createSubscriptionService();
  const isPremium = await subscriptionService.isUserPremium(userId);

  if (isPremium) return null;

  return {
    success: false,
    error: 'Premium subscription required to access private quizzes',
    statusCode: 403,
  };
}
