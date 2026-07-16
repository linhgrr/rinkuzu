import type { Quiz, QuizAuthorPreview } from '@/entities/Quiz';
import type { QuizListAuthorDto } from '@/dtos/quiz';

function isAuthorPreview(author: Quiz['author']): author is QuizAuthorPreview {
  return typeof author === 'object' && author !== null;
}

export function toQuizAuthorDto(
  author: Quiz['author'],
  options: { includeEmail: boolean },
): QuizListAuthorDto | null {
  if (!author) return null;
  if (!isAuthorPreview(author)) return { id: author };

  return {
    id: author.id,
    ...(options.includeEmail && author.email !== undefined ? { email: author.email } : {}),
    ...(author.name !== undefined ? { name: author.name } : {}),
    ...(author.displayName !== undefined ? { displayName: author.displayName } : {}),
    ...(author.avatar !== undefined ? { avatar: author.avatar } : {}),
  };
}
