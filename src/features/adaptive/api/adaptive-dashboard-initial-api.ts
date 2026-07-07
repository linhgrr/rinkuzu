import type { SessionHistoryItem } from '@/features/adaptive/types/history';
import type { PipelineJobHistoryItem } from '@/features/adaptive/types/pipeline';
import {
  toPipelineJobHistoryItem,
  toSubjectProgressItem,
} from '@/features/adaptive/mappers/pipeline.mapper';
import type { components } from '@/generated/adaptive-api';
import { fetchApiData } from '@/lib/api/client';
import { logger } from '@/lib/logger';
import {
  buildAdaptiveServiceHeaders,
  resolveAdaptiveApiUrl,
  resolveAdaptiveProxyTimeoutMs,
} from '@/lib/adaptive/config';

type AdaptiveDashboardPayload = {
  subjects: PipelineJobHistoryItem[];
  sessionHistory: SessionHistoryItem[];
  apiOnline: boolean | null;
  initialErrorKey: 'connectionLimited' | null;
};

type ApiSchemas = components['schemas'];

type AdaptiveFetchResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
    };

const INITIAL_DASHBOARD_TIMEOUT_MS = 6_000;

const fetchAdaptiveJson = async <T>(
  baseUrl: string,
  path: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<AdaptiveFetchResult<T>> => {
  try {
    const data = await fetchApiData<T>(`${baseUrl}${path}`, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { ok: true, data };
  } catch (error) {
    console.warn(
      `fetchAdaptiveJson: failed to load ${path}`,
      error instanceof Error ? error.message : error,
    );
    return { ok: false };
  }
};

export async function fetchAdaptiveDashboardData(
  userId: string,
): Promise<AdaptiveDashboardPayload> {
  try {
    const baseUrl = resolveAdaptiveApiUrl();
    const timeoutMs = Math.min(resolveAdaptiveProxyTimeoutMs(), INITIAL_DASHBOARD_TIMEOUT_MS);
    const headers = buildAdaptiveServiceHeaders(userId);

    const [subjectsResult, historyResult] = await Promise.allSettled([
      fetchAdaptiveJson<ApiSchemas['SubjectHistoryListResponse']>(
        baseUrl,
        '/api/history/subjects',
        headers,
        timeoutMs,
      ),
      fetchAdaptiveJson<ApiSchemas['SubjectProgressListResponse']>(
        baseUrl,
        '/api/history/subjects/progress?limit=50',
        headers,
        timeoutMs,
      ),
    ]);

    const subjects =
      subjectsResult.status === 'fulfilled' && subjectsResult.value.ok
        ? subjectsResult.value.data.subjects.map(toPipelineJobHistoryItem)
        : [];

    const sessionHistory =
      historyResult.status === 'fulfilled' && historyResult.value.ok
        ? historyResult.value.data.subjects.map(toSubjectProgressItem)
        : [];

    const subjectsFailed =
      subjectsResult.status === 'rejected' ||
      (subjectsResult.status === 'fulfilled' && !subjectsResult.value.ok);
    const historyFailed =
      historyResult.status === 'rejected' ||
      (historyResult.status === 'fulfilled' && !historyResult.value.ok);
    const hasInitialError = subjectsFailed || historyFailed;

    return {
      subjects,
      sessionHistory,
      apiOnline: subjectsFailed && historyFailed ? false : true,
      initialErrorKey: hasInitialError ? 'connectionLimited' : null,
    };
  } catch (error) {
    logger.error({ error }, 'Failed fetching adaptive learning data server-side');
    return {
      subjects: [],
      sessionHistory: [],
      apiOnline: false,
      initialErrorKey: 'connectionLimited',
    };
  }
}
