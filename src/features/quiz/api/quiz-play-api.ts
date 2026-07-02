import type { QuizPlayDetailDto } from '@/dtos/quiz';
import { toQuizPlayViewModel } from '@/features/quiz/mappers/quiz-play.mapper';
import type { QuizPlayViewModel } from '@/features/quiz/types/quiz-play-view-model';
import { fetchApiData } from '@/lib/api/client';
import { routePathSegment } from '@/lib/routing/routeParams';

export async function fetchQuizPlayViewModel(slug: string): Promise<QuizPlayViewModel> {
  const encodedSlug = routePathSegment(slug);
  const dto = await fetchApiData<QuizPlayDetailDto>(`/api/quiz/${encodedSlug}/play`);
  return toQuizPlayViewModel(dto);
}
