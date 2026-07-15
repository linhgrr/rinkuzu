import type { QuizPlayDetailDto } from '@/dtos/quiz';
import type { QuizPlayViewModel } from '@/features/quiz/types/quiz-play-view-model';

export function toQuizPlayViewModel(dto: QuizPlayDetailDto): QuizPlayViewModel {
  return {
    id: dto.id,
    title: dto.title,
    ...(dto.description !== undefined && { description: dto.description }),
    slug: dto.slug,
    author: dto.author,
    folder: dto.folder,
    isPrivate: dto.isPrivate,
    questionCount: dto.questionCount,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    ...(dto.pdfUrl !== undefined && { pdfUrl: dto.pdfUrl }),
    ...(dto.tags !== undefined && { tags: dto.tags }),
    questions: dto.questions.map((question) => ({
      id: question.id,
      question: question.question,
      options: question.options,
      type: question.type,
      ...(question.questionImage !== undefined && { questionImage: question.questionImage }),
      ...(question.optionImages !== undefined && { optionImages: question.optionImages }),
    })),
  };
}
