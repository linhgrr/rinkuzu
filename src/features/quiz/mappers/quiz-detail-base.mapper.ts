import type { QuizDetailDto } from '@/dtos/quiz';

export type QuizDetailBaseViewModel = Omit<QuizDetailDto, 'questions'>;

export function toQuizDetailBaseViewModel(dto: QuizDetailBaseViewModel): QuizDetailBaseViewModel {
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
  };
}
