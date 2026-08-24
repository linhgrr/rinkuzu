import type { Quiz } from '@/entities/Quiz';
import { ServiceResult } from '@/interfaces/services/types';

export function getAuthorId(author: Quiz['author'] | undefined): string | undefined {
  if (!author) return undefined;
  if (typeof author === 'string') return author;
  return author.id;
}

export async function checkQuizSourceAccess(
  quiz: Quiz,
  userId?: string,
  userRole?: string,
): Promise<ServiceResult<never> | null> {
  if (quiz.visibility === 'public') return null;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required to access personal quiz source',
      statusCode: 401,
    };
  }

  const authorId = getAuthorId(quiz.author);
  if (userRole === 'admin' || authorId === userId) return null;

  return {
    success: false,
    error: 'Personal quiz sources are only available to their owner or an admin',
    statusCode: 403,
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

  const sourceAccessError = await checkQuizSourceAccess(quiz, userId, userRole);
  return sourceAccessError ?? { success: true, data: quiz };
}
