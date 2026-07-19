import type { Quiz, QuizAuthorPreview } from '@/entities/Quiz';
import type { QuizListAuthorDto } from '@/dtos/quiz';

function isAuthorPreview(author: Quiz['author']): author is QuizAuthorPreview {
  return typeof author === 'object' && author !== null;
}

/**
 * Public author identity for quiz list/detail/play contracts.
 * Stable public fields only — never email or other PII.
 */
export function toQuizAuthorDto(author: Quiz['author']): QuizListAuthorDto | null {
  if (!author) return null;
  if (!isAuthorPreview(author)) return { id: author };

  return {
    id: author.id,
    ...(author.name !== undefined ? { name: author.name } : {}),
    ...(author.displayName !== undefined ? { displayName: author.displayName } : {}),
    ...(author.avatar !== undefined ? { avatar: author.avatar } : {}),
  };
}
