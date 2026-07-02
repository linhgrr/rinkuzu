import type { AdminQuizDetailDto, AdminQuizListDto, AdminQuizListItemDto } from '@/dtos/admin-quiz';
import type {
  AdminQuizDetailViewModel,
  AdminQuizListItemViewModel,
  AdminQuizListViewModel,
} from '@/features/admin/quizzes/types/admin-quizzes-view-model';

export function toAdminQuizListItemViewModel(
  quiz: AdminQuizListItemDto,
): AdminQuizListItemViewModel {
  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    slug: quiz.slug,
    author: quiz.author,
    folder: quiz.folder,
    isPrivate: quiz.isPrivate,
    visibilityLabelKey: quiz.isPrivate ? 'private' : 'public',
    questionCount: quiz.questionCount,
    createdAt: quiz.createdAt,
    updatedAt: quiz.updatedAt,
  };
}

export function toAdminQuizDetailViewModel(quiz: AdminQuizDetailDto): AdminQuizDetailViewModel {
  return {
    ...toAdminQuizListItemViewModel(quiz),
    questions: quiz.questions,
    pdfUrl: quiz.pdfUrl,
    tags: quiz.tags,
  };
}

export function toAdminQuizListViewModel(dto: AdminQuizListDto): AdminQuizListViewModel {
  return {
    quizzes: dto.quizzes.map(toAdminQuizListItemViewModel),
    pagination: {
      page: dto.pagination.currentPage,
      limit: dto.pagination.itemsPerPage,
      total: dto.pagination.totalItems,
      totalPages: dto.pagination.totalPages,
      hasNextPage: dto.pagination.hasNextPage,
      hasPrevPage: dto.pagination.hasPrevPage,
    },
  };
}
