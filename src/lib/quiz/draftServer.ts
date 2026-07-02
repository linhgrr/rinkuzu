import 'server-only';
import { fetchApiData, ApiResponseError } from '@/lib/api/client';
import {
  buildAdaptiveServiceHeaders,
  resolveAdaptiveApiUrl,
  resolveAdaptiveProxyTimeoutMs,
} from '@/lib/adaptive/config';
import type { QuizDraftSingleResponseDto } from '@/dtos/quiz-draft';
import type { QuizDraft } from '@/features/quiz/types/quiz-draft';
import { QuizDraftMapper } from '@/mappers/quiz/QuizDraftMapper';

// Server-side fetch of a single quiz draft straight from FastAPI (the edit
// page is a Server Component and cannot go through the same-origin proxy).
export async function fetchQuizDraftServer(
  draftId: string,
  userId: string,
): Promise<QuizDraft | null> {
  const baseUrl = resolveAdaptiveApiUrl();
  const headers = buildAdaptiveServiceHeaders(userId);

  try {
    const { draft } = await fetchApiData<QuizDraftSingleResponseDto>(
      `${baseUrl}/api/quiz/drafts/${draftId}`,
      {
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(resolveAdaptiveProxyTimeoutMs()),
      },
    );
    return QuizDraftMapper.toViewModel(draft);
  } catch (error) {
    if (error instanceof ApiResponseError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
