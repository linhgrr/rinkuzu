import type { Quiz } from '@/entities/Quiz';
import { createSubscriptionService } from '@/lib/subscription-factory';
import { ServiceResult } from '@/interfaces/services/types';

export function getAuthorId(author: Quiz['author'] | undefined): string | undefined {
  if (!author) return undefined;
  if (typeof author === 'string') return author;
  return author.id;
}

export async function checkPrivateQuizAccess(
  quiz: Quiz,
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

  const subscriptionService = createSubscriptionService();
  const isPremium = await subscriptionService.isUserPremium(userId);

  if (isPremium) return null;

  return {
    success: false,
    error: 'Premium subscription required to access private quizzes',
    statusCode: 403,
  };
}
