import 'server-only';
import { fetchApiData } from '@/lib/api/client';
import {
  buildAdaptiveServiceHeaders,
  resolveAdaptiveApiUrl,
  resolveAdaptiveProxyTimeoutMs,
} from '@/lib/adaptive/config';
import {
  normalizeQuizDraftTransport,
  type LegacyQuizDraftTransport,
  type QuizDraft,
} from '@/lib/quiz/draftApi';

// Server-side fetch of a single quiz draft straight from FastAPI (the edit
// page is a Server Component and cannot go through the same-origin proxy).
export async function fetchQuizDraftServer(
  draftId: string,
  userId: string,
): Promise<QuizDraft | null> {
  const baseUrl = resolveAdaptiveApiUrl();
  const headers = buildAdaptiveServiceHeaders(userId);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), resolveAdaptiveProxyTimeoutMs());

  try {
    const { draft } = await fetchApiData<{ draft: LegacyQuizDraftTransport }>(
      `${baseUrl}/api/quiz/drafts/${draftId}`,
      {
        headers,
        cache: 'no-store',
        signal: controller.signal,
      },
    );
    return draft ? normalizeQuizDraftTransport(draft) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
