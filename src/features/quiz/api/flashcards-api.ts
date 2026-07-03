import type { FlashcardQuizDto } from '@/dtos/quiz';
import type { SubmitReviewResponseDto } from '@/dtos/review';
import { toFlashcardQuizViewModel } from '@/features/quiz/mappers/flashcard.mapper';
import type {
  FlashcardQuizViewModel,
  FlashcardReviewInput,
} from '@/features/quiz/types/flashcard-view-model';
import { fetchApiData } from '@/lib/api/client';
import { getCorrectAnswerIndexes } from '@/lib/quiz/answer-text';
import { routePathSegment } from '@/lib/routing/routeParams';

export async function fetchFlashcardQuizViewModel(slug: string): Promise<FlashcardQuizViewModel> {
  const encodedSlug = routePathSegment(slug);
  const dto = await fetchApiData<FlashcardQuizDto>(`/api/quiz/${encodedSlug}/flashcards`);
  return toFlashcardQuizViewModel(dto);
}

export async function submitFlashcardReview(
  input: FlashcardReviewInput,
): Promise<SubmitReviewResponseDto> {
  return fetchApiData<SubmitReviewResponseDto>('/api/review/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      questionId: input.question.id,
      quizSlug: input.quizSlug,
      rating: input.rating,
      questionRef: {
        text: input.question.question,
        options: input.question.options,
        correctIndexes: getCorrectAnswerIndexes(input.question),
      },
    }),
  });
}
