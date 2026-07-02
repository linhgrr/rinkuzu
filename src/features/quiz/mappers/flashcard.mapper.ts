import type { FlashcardQuizDto } from '@/dtos/quiz';
import type { FlashcardQuizViewModel } from '@/features/quiz/types/flashcard-view-model';

export function toFlashcardQuizViewModel(dto: FlashcardQuizDto): FlashcardQuizViewModel {
  return {
    id: dto.id,
    title: dto.title,
    slug: dto.slug,
    description: dto.description,
    questions: dto.questions.map((question) => ({ ...question })),
  };
}
