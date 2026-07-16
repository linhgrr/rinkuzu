import type { Quiz } from '@/entities/Quiz';
import { can, resolveEntitlements } from '@/lib/entitlements';
import { ServiceResult } from '@/interfaces/services/types';

export const PREMIUM_REQUIRED_CODE = 'premium_required';

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

  const entitlements = await resolveEntitlements(userId);
  if (can(entitlements, 'private_quiz')) return null;

  return {
    success: false,
    error: 'Premium subscription required to access private quizzes',
    statusCode: 403,
    code: PREMIUM_REQUIRED_CODE,
  };
}

export async function requireQuizReadAccess(
  quiz: Quiz | null,
  userId?: string,
  userRole?: string,
): Promise<ServiceResult<Quiz>> {
  if (!quiz) {
    return {
      success: false,
      error: 'Quiz not found',
      statusCode: 404,
    };
  }

  const privateAccessError = await checkPrivateQuizAccess(quiz, userId, userRole);
  return privateAccessError ?? { success: true, data: quiz };
}
