import type { AdminQuizDetailDto, AdminQuizListDto, AdminQuizListItemDto } from '@/dtos/admin-quiz';
import type { QuizQuestionDto } from '@/dtos/quiz';
import type {
  AdminQuizDetailViewModel,
  AdminQuizListItemViewModel,
  AdminQuizListViewModel,
} from '@/features/admin/quizzes/types/admin-quizzes-view-model';
import type { QuizPreviewQuestionViewModel } from '@/features/quiz/types/quiz-preview-view-model';

function toQuizPreviewQuestionViewModel(question: QuizQuestionDto): QuizPreviewQuestionViewModel {
  const base = {
    id: question.id,
    question: question.question,
    options: question.options,
    ...(question.questionImage !== undefined && { questionImage: question.questionImage }),
    ...(question.optionImages !== undefined && { optionImages: question.optionImages }),
  };

  return question.type === 'single'
    ? { ...base, type: 'single', correctIndex: question.correctIndex }
    : { ...base, type: 'multiple', correctIndexes: question.correctIndexes };
}

export function toAdminQuizListItemViewModel(
  quiz: AdminQuizListItemDto,
): AdminQuizListItemViewModel {
  return {
    id: quiz.id,
    title: quiz.title,
    ...(quiz.description !== undefined && { description: quiz.description }),
    slug: quiz.slug,
    author: quiz.author,
    ...(quiz.folder !== undefined && { folder: quiz.folder }),
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
    questions: quiz.questions.map(toQuizPreviewQuestionViewModel),
    ...(quiz.pdfUrl !== undefined && { pdfUrl: quiz.pdfUrl }),
    ...(quiz.tags !== undefined && { tags: quiz.tags }),
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
