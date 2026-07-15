import type { QuizListDto, QuizListItemDto } from '@/dtos/quiz';
import type {
  QuizListItemViewModel,
  QuizListViewModel,
} from '@/features/quiz/types/quiz-list-view-model';

export function toQuizListItemViewModel(quiz: QuizListItemDto): QuizListItemViewModel {
  return {
    id: quiz.id,
    title: quiz.title,
    ...(quiz.description !== undefined && { description: quiz.description }),
    slug: quiz.slug,
    author: quiz.author,
    folderId: quiz.folder,
    isPrivate: quiz.isPrivate,
    questionCount: quiz.questionCount,
    createdAt: quiz.createdAt,
    updatedAt: quiz.updatedAt,
  };
}

export function toQuizListViewModel(dto: QuizListDto): QuizListViewModel {
  return {
    quizzes: dto.quizzes.map(toQuizListItemViewModel),
    pagination: {
      currentPage: dto.pagination.currentPage,
      totalPages: dto.pagination.totalPages,
      totalItems: dto.pagination.totalItems,
      itemsPerPage: dto.pagination.itemsPerPage,
      hasNextPage: dto.pagination.hasNextPage,
      hasPrevPage: dto.pagination.hasPrevPage,
    },
  };
}
