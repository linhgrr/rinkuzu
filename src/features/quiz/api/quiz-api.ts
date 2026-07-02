import { fetchApiData } from '@/lib/api/client';
import { routePathSegment } from '@/lib/routing/routeParams';

export async function deleteQuizById(quizId: string): Promise<void> {
  const encodedQuizId = routePathSegment(quizId);
  await fetchApiData<null>(`/api/quizzes/${encodedQuizId}`, { method: 'DELETE' });
}
