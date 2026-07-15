import type { FlashcardQuizDto } from '@/dtos/quiz';
import type { FlashcardQuizViewModel } from '@/features/quiz/types/flashcard-view-model';

export function toFlashcardQuizViewModel(dto: FlashcardQuizDto): FlashcardQuizViewModel {
  return {
    id: dto.id,
    title: dto.title,
    slug: dto.slug,
    ...(dto.description !== undefined && { description: dto.description }),
    questions: dto.questions.map((question) => ({
      id: question.id,
      question: question.question,
      options: question.options,
      type: question.type,
      ...(question.correctIndex !== undefined && { correctIndex: question.correctIndex }),
      ...(question.correctIndexes !== undefined && { correctIndexes: question.correctIndexes }),
      ...(question.questionImage !== undefined && { questionImage: question.questionImage }),
      ...(question.optionImages !== undefined && { optionImages: question.optionImages }),
    })),
  };
}
