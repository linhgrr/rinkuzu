import type {
  PipelineJobHistoryItem,
  SessionHistoryItem,
} from '@/features/adaptive-learning/types';
import {
  buildAdaptiveServiceHeaders,
  resolveAdaptiveApiUrl,
  resolveAdaptiveProxyTimeoutMs,
} from '@/lib/adaptive-learning/config';

type AdaptiveDashboardPayload = {
  subjects: PipelineJobHistoryItem[];
  sessionHistory: SessionHistoryItem[];
};

type AdaptiveStandardResponse<T> = {
  success: true;
  data: T;
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
    const response = await fetch(`${baseUrl}${path}`, {
      headers,
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`fetchAdaptiveJson: ${path} returned ${response.status}`);
      return null;
    }

    let rawText: string;
    try {
      rawText = await response.text();
    } catch {
      console.error(`fetchAdaptiveJson: failed to read body from ${path}`);
      return null;
    }

    if (!rawText) {
      console.warn(`fetchAdaptiveJson: ${path} returned empty body`);
      return null;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawText);
    } catch {
      console.error(
        `fetchAdaptiveJson: failed to parse JSON from ${path}, body starts with: ${rawText.slice(0, 200)}`,
      );
      return null;
    }

    if (
      payload &&
      typeof payload === 'object' &&
      'success' in payload &&
      payload.success === true &&
      'data' in payload
    ) {
      return (payload as AdaptiveStandardResponse<T>).data;
    }

    return payload as T | null;
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
