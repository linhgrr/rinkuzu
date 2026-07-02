import type { QuizListDto } from '@/dtos/quiz';
import { toQuizListViewModel } from '@/features/quiz/mappers/quiz-list.mapper';
import type { QuizListViewModel } from '@/features/quiz/types/quiz-list-view-model';
import { fetchApiData } from '@/lib/api/client';

export async function fetchQuizListViewModel(url: string): Promise<QuizListViewModel> {
  const dto = await fetchApiData<QuizListDto>(url);
  return toQuizListViewModel(dto);
}
