import type { DeleteResultDto } from '@/dtos/common';
import { fetchApiData } from '@/lib/api/client';
import { routePathSegment } from '@/lib/routing/routeParams';

export async function deleteQuizById(quizId: string): Promise<DeleteResultDto> {
  const encodedQuizId = routePathSegment(quizId);
  return fetchApiData<DeleteResultDto>(`/api/quizzes/${encodedQuizId}`, { method: 'DELETE' });
}
