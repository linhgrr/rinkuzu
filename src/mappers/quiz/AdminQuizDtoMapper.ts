import type {
  AdminQuizAuthorDto,
  AdminQuizDetailDto,
  AdminQuizListDto,
  AdminQuizListItemDto,
  AdminQuizVisibilityChangeDto,
} from '@/dtos/admin-quiz';
import type { PaginationMeta } from '@/dtos/common';
import type { Quiz, QuizAuthorPreview, QuizVisibility } from '@/entities/Quiz';
import { serializeDate } from '@/lib/date-serialization';
import { toQuizQuestionDto } from '@/mappers/quiz/QuizQuestionDtoMapper';

function isAuthorPreview(author: Quiz['author']): author is QuizAuthorPreview {
  return typeof author === 'object' && author !== null;
}

function toAuthorDto(author: Quiz['author']): AdminQuizAuthorDto {
  if (!isAuthorPreview(author)) {
    return { id: author };
  }

  return {
    id: author.id,
    ...(author.email !== undefined && { email: author.email }),
    ...(author.name !== undefined && { name: author.name }),
    ...(author.displayName !== undefined && { displayName: author.displayName }),
    ...(author.avatar !== undefined && { avatar: author.avatar }),
  };
}

export class AdminQuizDtoMapper {
  static toListDto(quizzes: Quiz[], pagination: PaginationMeta): AdminQuizListDto {
    return {
      quizzes: quizzes.map(AdminQuizDtoMapper.toListItem),
      pagination,
    };
  }

  static toListItem(quiz: Quiz): AdminQuizListItemDto {
    return {
      id: quiz.id,
      title: quiz.title,
      ...(quiz.description !== undefined && { description: quiz.description }),
      slug: quiz.slug,
      author: toAuthorDto(quiz.author),
      ...(quiz.folder !== undefined && { folder: quiz.folder }),
      visibility: quiz.visibility,
      questionCount: quiz.questionCount ?? quiz.questions.length,
      ...(quiz.contentFlags?.personalData === true && {
        personalDataKinds: [...quiz.contentFlags.kinds],
      }),
      createdAt: serializeDate(quiz.createdAt, 'quiz.createdAt'),
      updatedAt: serializeDate(quiz.updatedAt, 'quiz.updatedAt'),
    };
  }

  static toDetail(quiz: Quiz): AdminQuizDetailDto {
    return {
      ...AdminQuizDtoMapper.toListItem(quiz),
      questions: quiz.questions.map(toQuizQuestionDto),
      ...(quiz.pdfUrl !== undefined && { pdfUrl: quiz.pdfUrl }),
      ...(quiz.tags !== undefined && { tags: quiz.tags }),
    };
  }

  static toVisibilityChange(
    quiz: Pick<Quiz, 'id' | 'slug'>,
    visibility: QuizVisibility,
    changed: boolean,
  ): AdminQuizVisibilityChangeDto {
    return { id: quiz.id, slug: quiz.slug, visibility, changed };
  }
}
