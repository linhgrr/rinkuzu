import type { AdminQuizDetailDto, AdminQuizListDto, AdminQuizListItemDto } from '@/dtos/admin-quiz';
import type {
  AdminQuizDetailViewModel,
  AdminQuizListItemViewModel,
  AdminQuizListViewModel,
} from '@/features/admin/quizzes/types/admin-quizzes-view-model';
import type { QuizPreviewQuestionViewModel } from '@/features/quiz/types/quiz-preview-view-model';
import { copyQuizQuestionFields } from '@/lib/quiz/question-fields';

function toAdminQuizListItemViewModel(quiz: AdminQuizListItemDto): AdminQuizListItemViewModel {
  return {
    id: quiz.id,
    title: quiz.title,
    ...(quiz.description !== undefined && { description: quiz.description }),
    slug: quiz.slug,
    author: quiz.author,
    ...(quiz.folder !== undefined && { folder: quiz.folder }),
    visibility: quiz.visibility,
    visibilityLabelKey: quiz.visibility,
    questionCount: quiz.questionCount,
    ...(quiz.personalDataKinds !== undefined && { personalDataKinds: [...quiz.personalDataKinds] }),
    createdAt: quiz.createdAt,
    updatedAt: quiz.updatedAt,
  };
}

function toAdminQuizQuestionViewModel(
  question: AdminQuizDetailDto['questions'][number],
): QuizPreviewQuestionViewModel {
  const base = copyQuizQuestionFields(question);
  return question.type === 'single'
    ? {
        ...base,
        type: 'single',
        correctIndex: question.correctIndex,
      }
    : {
        ...base,
        type: 'multiple',
        correctIndexes: question.correctIndexes,
      };
}

export function toAdminQuizDetailViewModel(quiz: AdminQuizDetailDto): AdminQuizDetailViewModel {
  return {
    ...toAdminQuizListItemViewModel(quiz),
    questions: quiz.questions.map(toAdminQuizQuestionViewModel),
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
