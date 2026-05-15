import type {
  PipelineJobHistoryItem,
  SessionHistoryItem,
} from '@/features/adaptive-learning/types';
import { fetchApiData } from '@/lib/api/client';
import {
  buildAdaptiveServiceHeaders,
  resolveAdaptiveApiUrl,
  resolveAdaptiveProxyTimeoutMs,
} from '@/lib/adaptive-learning/config';

type AdaptiveDashboardPayload = {
  subjects: PipelineJobHistoryItem[];
  sessionHistory: SessionHistoryItem[];
};

const fetchAdaptiveJson = async <T>(
  baseUrl: string,
  path: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<T | null> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    try {
      return await fetchApiData<T>(`${baseUrl}${path}`, {
        headers,
        cache: 'no-store',
        signal: controller.signal,
      });
    } catch (error) {
      console.warn(
        `fetchAdaptiveJson: failed to load ${path}`,
        error instanceof Error ? error.message : error,
      );
      return null;
    }
  } finally {
    clearTimeout(timeout);
  }
};

export async function fetchAdaptiveDashboardData(
  userId: string,
): Promise<AdaptiveDashboardPayload> {
  try {
    const baseUrl = resolveAdaptiveApiUrl();
    const timeoutMs = resolveAdaptiveProxyTimeoutMs();
    const headers = buildAdaptiveServiceHeaders(userId);

    const [subjectsResult, historyResult] = await Promise.allSettled([
      fetchAdaptiveJson<{ subjects?: PipelineJobHistoryItem[] }>(
        baseUrl,
        '/api/history/subjects',
        headers,
        timeoutMs,
      ),
      fetchAdaptiveJson<{ subjects?: SessionHistoryItem[] }>(
        baseUrl,
        '/api/history/subjects/progress?limit=5',
        headers,
        timeoutMs,
      ),
    ]);

    const subjects =
      subjectsResult.status === 'fulfilled' ? (subjectsResult.value?.subjects ?? []) : [];

    const sessionHistory =
      historyResult.status === 'fulfilled' ? (historyResult.value?.subjects ?? []) : [];

    return { subjects, sessionHistory };
  } catch (error) {
    console.error('Failed fetching adaptive learning data server-side:', error);
    return { subjects: [], sessionHistory: [] };
  }
}
