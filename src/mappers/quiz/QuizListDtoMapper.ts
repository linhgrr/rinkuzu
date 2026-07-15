import type { Quiz, QuizAuthorPreview } from '@/entities/Quiz';
import type { QuizListAuthorDto, QuizListItemDto } from '@/dtos/quiz';
import { serializeDate } from '@/lib/date-serialization';

function isAuthorPreview(author: Quiz['author']): author is QuizAuthorPreview {
  return typeof author === 'object' && author !== null;
}

function toAuthorDto(author: Quiz['author']): QuizListAuthorDto | null {
  if (!author) return null;
  if (!isAuthorPreview(author)) return { id: author };

  return {
    id: author.id,
    ...(author.email === undefined ? {} : { email: author.email }),
    ...(author.name === undefined ? {} : { name: author.name }),
    ...(author.displayName === undefined ? {} : { displayName: author.displayName }),
    ...(author.avatar === undefined ? {} : { avatar: author.avatar }),
  };
}

export class QuizListDtoMapper {
  static toListItem(quiz: Quiz): QuizListItemDto {
    return {
      id: quiz.id,
      title: quiz.title,
      slug: quiz.slug,
      author: toAuthorDto(quiz.author),
      folder: quiz.folder ?? null,
      isPrivate: quiz.isPrivate,
      questionCount: quiz.questionCount ?? quiz.questions.length,
      createdAt: serializeDate(quiz.createdAt, 'quiz.createdAt'),
      updatedAt: serializeDate(quiz.updatedAt, 'quiz.updatedAt'),
      ...(quiz.description === undefined ? {} : { description: quiz.description }),
    };
  }
}
