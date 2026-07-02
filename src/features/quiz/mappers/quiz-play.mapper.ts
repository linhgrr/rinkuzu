import type { QuizPlayDetailDto } from '@/dtos/quiz';
import type { QuizPlayViewModel } from '@/features/quiz/types/quiz-play-view-model';

export function toQuizPlayViewModel(dto: QuizPlayDetailDto): QuizPlayViewModel {
  return {
    id: dto.id,
    title: dto.title,
    description: dto.description,
    slug: dto.slug,
    author: dto.author,
    folder: dto.folder,
    isPrivate: dto.isPrivate,
    questionCount: dto.questionCount,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    pdfUrl: dto.pdfUrl,
    tags: dto.tags,
    questions: dto.questions.map((question) => ({ ...question })),
  };
}
