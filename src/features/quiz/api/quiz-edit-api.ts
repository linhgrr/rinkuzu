import type { QuizDetailDto } from '@/dtos/quiz';
import { toQuizEditViewModel } from '@/features/quiz/mappers/quiz-editor.mapper';
import type {
  QuizEditViewModel,
  UpdateQuizEditInput,
} from '@/features/quiz/types/quiz-editor-view-model';
import { fetchApiData } from '@/lib/api/client';
import { routePathSegment } from '@/lib/routing/routeParams';

export async function fetchQuizEditViewModel(quizId: string): Promise<QuizEditViewModel> {
  const encodedQuizId = routePathSegment(quizId);
  const dto = await fetchApiData<QuizDetailDto>(`/api/quizzes/${encodedQuizId}`);
  return toQuizEditViewModel(dto);
}

export async function updateQuizEditViewModel(
  quizId: string,
  input: UpdateQuizEditInput,
): Promise<QuizEditViewModel> {
  const encodedQuizId = routePathSegment(quizId);
  const dto = await fetchApiData<QuizDetailDto>(`/api/quizzes/${encodedQuizId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  return toQuizEditViewModel(dto);
}
