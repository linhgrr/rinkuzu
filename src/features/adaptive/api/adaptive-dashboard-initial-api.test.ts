import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { components } from '@/generated/adaptive-api';

const {
  fetchApiDataMock,
  buildAdaptiveServiceHeadersMock,
  buildAdaptiveUrlMock,
  resolveAdaptiveProxyTimeoutMsMock,
  loggerErrorMock,
} = vi.hoisted(() => ({
  fetchApiDataMock: vi.fn(),
  buildAdaptiveServiceHeadersMock: vi.fn(),
  buildAdaptiveUrlMock: vi.fn((path: string) => `https://adaptive.test/api/v1${path}`),
  resolveAdaptiveProxyTimeoutMsMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  fetchApiData: fetchApiDataMock,
}));

vi.mock('@/lib/adaptive/config', () => ({
  buildAdaptiveServiceHeaders: buildAdaptiveServiceHeadersMock,
  buildAdaptiveUrl: buildAdaptiveUrlMock,
  resolveAdaptiveProxyTimeoutMs: resolveAdaptiveProxyTimeoutMsMock,
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock },
}));

import { fetchAdaptiveDashboardData } from './adaptive-dashboard-initial-api';

type ApiSchemas = components['schemas'];

const USER_ID = 'user-abc-123';
const INITIAL_DASHBOARD_TIMEOUT_MS = 6_000;

function subjectHistory(overrides: Partial<ApiSchemas['SubjectHistoryResponse']> = {}) {
  return {
    job_id: 'job-hist-1',
    filename: 'algebra.pdf',
    subject_id: 'Algebra',
    status: 'completed' as const,
    concepts_extracted: 12,
    concepts_after_merge: 10,
    relations_verified: 8,
    completed_at: 1_700_000_000,
    mastered_concept: 4,
    all_concept: 10,
    unlocked_concept: 6,
    locked_concept: 4,
    progress_percent: 55,
    ...overrides,
  } satisfies ApiSchemas['SubjectHistoryResponse'];
}

function progressItem(
  overrides: Partial<ApiSchemas['SubjectProgressSummaryResponse']> = {},
): ApiSchemas['SubjectProgressSummaryResponse'] {
  return {
    job_id: 'job-prog-1',
    filename: 'algebra.pdf',
    subject_id: 'Algebra',
    status: 'active',
    total_correct: 3,
    total_answered: 5,
    accuracy: 0.6,
    avg_mastery: 0.4,
    unlocked_concepts: 2,
    locked_concepts: 1,
    mastered_concepts: 1,
    progress_percent: 40,
    step: 2,
    max_steps: 5,
    created_at: 1_700_000_000,
    updated_at: 1_700_000_100,
    last_session_id: 'session-1',
    ...overrides,
  };
}

function mockSubjectsResponse(
  subjects: ApiSchemas['SubjectHistoryResponse'][] = [subjectHistory()],
) {
  return { subjects, count: subjects.length };
}

function mockProgressResponse(
  subjects: ApiSchemas['SubjectProgressSummaryResponse'][] = [progressItem()],
) {
  return { subjects, count: subjects.length };
}

function getCallForPath(pathFragment: string) {
  const match = fetchApiDataMock.mock.calls.find(([url]) => String(url).includes(pathFragment));
  if (!match) {
    throw new Error(`No fetchApiData call for path fragment: ${pathFragment}`);
  }
  return match as [string, RequestInit & { cache?: RequestCache }];
}

beforeEach(() => {
  vi.clearAllMocks();
  buildAdaptiveServiceHeadersMock.mockReturnValue({
    'x-user-id': USER_ID,
    authorization: 'Bearer test',
  });
  buildAdaptiveUrlMock.mockImplementation((path: string) => `https://adaptive.test/api/v1${path}`);
  resolveAdaptiveProxyTimeoutMsMock.mockReturnValue(30_000);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchAdaptiveDashboardData', () => {
  it('requests subjects and progress with capped timeout, headers, and no-store cache', async () => {
    const abortSpy = vi.spyOn(AbortSignal, 'timeout');
    fetchApiDataMock
      .mockResolvedValueOnce(mockSubjectsResponse())
      .mockResolvedValueOnce(mockProgressResponse());

    const result = await fetchAdaptiveDashboardData(USER_ID);

    expect(resolveAdaptiveProxyTimeoutMsMock).toHaveBeenCalledTimes(1);
    expect(buildAdaptiveServiceHeadersMock).toHaveBeenCalledTimes(1);
    expect(buildAdaptiveServiceHeadersMock).toHaveBeenCalledWith(USER_ID);
    expect(buildAdaptiveUrlMock).toHaveBeenCalledWith('/history/subjects');
    expect(buildAdaptiveUrlMock).toHaveBeenCalledWith('/history/subjects/progress?limit=50');

    expect(fetchApiDataMock).toHaveBeenCalledTimes(2);
    const [subjectsUrl, subjectsInit] = getCallForPath('/history/subjects');
    const [progressUrl, progressInit] = getCallForPath('/history/subjects/progress?limit=50');

    expect(subjectsUrl).toBe('https://adaptive.test/api/v1/history/subjects');
    expect(progressUrl).toBe('https://adaptive.test/api/v1/history/subjects/progress?limit=50');
    expect(subjectsInit).toMatchObject({
      headers: { 'x-user-id': USER_ID, authorization: 'Bearer test' },
      cache: 'no-store',
    });
    expect(progressInit).toMatchObject({
      headers: { 'x-user-id': USER_ID, authorization: 'Bearer test' },
      cache: 'no-store',
    });
    expect(subjectsInit.signal).toBeInstanceOf(AbortSignal);
    expect(progressInit.signal).toBeInstanceOf(AbortSignal);
    expect(abortSpy).toHaveBeenCalledWith(INITIAL_DASHBOARD_TIMEOUT_MS);

    expect(result).toEqual({
      subjects: [subjectHistory()],
      sessionHistory: [progressItem()],
      apiOnline: true,
      initialErrorKey: null,
    });
  });

  it('uses the adaptive proxy timeout when it is lower than the 6s dashboard cap', async () => {
    resolveAdaptiveProxyTimeoutMsMock.mockReturnValue(1_500);
    const abortSpy = vi.spyOn(AbortSignal, 'timeout');
    fetchApiDataMock
      .mockResolvedValueOnce(mockSubjectsResponse([]))
      .mockResolvedValueOnce(mockProgressResponse([]));

    await fetchAdaptiveDashboardData(USER_ID);

    expect(abortSpy).toHaveBeenCalledWith(1_500);
  });

  it('returns online with no error when both endpoints succeed with empty lists', async () => {
    fetchApiDataMock
      .mockResolvedValueOnce(mockSubjectsResponse([]))
      .mockResolvedValueOnce(mockProgressResponse([]));

    await expect(fetchAdaptiveDashboardData(USER_ID)).resolves.toEqual({
      subjects: [],
      sessionHistory: [],
      apiOnline: true,
      initialErrorKey: null,
    });
  });

  it('maps multiple subjects and progress rows through identity/progress mappers', async () => {
    const subjects = [
      subjectHistory({ job_id: 'job-a', subject_id: 'A' }),
      subjectHistory({ job_id: 'job-b', subject_id: 'B', progress_percent: 90 }),
    ];
    const progress = [
      progressItem({ job_id: 'job-a', status: 'completed', total_answered: 10 }),
      progressItem({ job_id: 'job-b', status: 'active', total_answered: 1 }),
    ];
    fetchApiDataMock
      .mockResolvedValueOnce(mockSubjectsResponse(subjects))
      .mockResolvedValueOnce(mockProgressResponse(progress));

    const result = await fetchAdaptiveDashboardData(USER_ID);

    expect(result.subjects).toEqual(subjects);
    expect(result.sessionHistory).toEqual(progress);
    expect(result.apiOnline).toBe(true);
    expect(result.initialErrorKey).toBeNull();
  });

  it('treats subjects failure with progress success as partial online + connectionLimited', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    fetchApiDataMock
      .mockRejectedValueOnce(new Error('subjects down'))
      .mockResolvedValueOnce(mockProgressResponse([progressItem({ job_id: 'alive' })]));

    const result = await fetchAdaptiveDashboardData(USER_ID);

    expect(result).toEqual({
      subjects: [],
      sessionHistory: [progressItem({ job_id: 'alive' })],
      apiOnline: true,
      initialErrorKey: 'connectionLimited',
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('fetchAdaptiveJson: failed to load'),
      'subjects down',
    );
  });

  it('treats progress failure with subjects success as partial online + connectionLimited', async () => {
    fetchApiDataMock
      .mockResolvedValueOnce(mockSubjectsResponse([subjectHistory({ job_id: 'ok-job' })]))
      .mockRejectedValueOnce('progress boom');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const result = await fetchAdaptiveDashboardData(USER_ID);

    expect(result).toEqual({
      subjects: [subjectHistory({ job_id: 'ok-job' })],
      sessionHistory: [],
      apiOnline: true,
      initialErrorKey: 'connectionLimited',
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('fetchAdaptiveJson: failed to load'),
      'progress boom',
    );
  });

  it('marks fully offline when both endpoints fail', async () => {
    fetchApiDataMock
      .mockRejectedValueOnce(new Error('subjects offline'))
      .mockRejectedValueOnce(new Error('progress offline'));

    await expect(fetchAdaptiveDashboardData(USER_ID)).resolves.toEqual({
      subjects: [],
      sessionHistory: [],
      apiOnline: false,
      initialErrorKey: 'connectionLimited',
    });
  });

  it('treats AbortSignal timeout rejections as endpoint failures', async () => {
    const timeoutError = new DOMException(
      'The operation was aborted due to timeout',
      'TimeoutError',
    );
    fetchApiDataMock.mockRejectedValueOnce(timeoutError).mockRejectedValueOnce(timeoutError);

    await expect(fetchAdaptiveDashboardData(USER_ID)).resolves.toEqual({
      subjects: [],
      sessionHistory: [],
      apiOnline: false,
      initialErrorKey: 'connectionLimited',
    });
  });

  it('recovers offline outer failures via logger.error and empty offline payload', async () => {
    const failure = new Error('headers exploded');
    buildAdaptiveServiceHeadersMock.mockImplementation(() => {
      throw failure;
    });

    const result = await fetchAdaptiveDashboardData(USER_ID);

    expect(result).toEqual({
      subjects: [],
      sessionHistory: [],
      apiOnline: false,
      initialErrorKey: 'connectionLimited',
    });
    expect(loggerErrorMock).toHaveBeenCalledTimes(1);
    expect(loggerErrorMock).toHaveBeenCalledWith(
      { error: failure },
      'Failed fetching adaptive learning data server-side',
    );
    expect(fetchApiDataMock).not.toHaveBeenCalled();
  });

  it('outer catch also handles non-Error throwables from resolveAdaptiveProxyTimeoutMs', async () => {
    resolveAdaptiveProxyTimeoutMsMock.mockImplementation(() => {
      throw 'timeout-config-missing';
    });

    await expect(fetchAdaptiveDashboardData(USER_ID)).resolves.toEqual({
      subjects: [],
      sessionHistory: [],
      apiOnline: false,
      initialErrorKey: 'connectionLimited',
    });
    expect(loggerErrorMock).toHaveBeenCalledWith(
      { error: 'timeout-config-missing' },
      'Failed fetching adaptive learning data server-side',
    );
  });

  it('falls back to offline payload when progress status mapping throws', async () => {
    fetchApiDataMock
      .mockResolvedValueOnce(mockSubjectsResponse([subjectHistory()]))
      .mockResolvedValueOnce(
        mockProgressResponse([
          progressItem({
            status: 'not_started' as ApiSchemas['SubjectProgressStatus'],
          }),
        ]),
      );

    await expect(fetchAdaptiveDashboardData(USER_ID)).resolves.toEqual({
      subjects: [],
      sessionHistory: [],
      apiOnline: false,
      initialErrorKey: 'connectionLimited',
    });
    expect(loggerErrorMock).toHaveBeenCalledTimes(1);
  });

  it('uses empty collections when fulfilled fetchAdaptiveJson returns ok:false shape via rejection path', async () => {
    // fetchApiData rejects → fetchAdaptiveJson returns { ok: false }
    fetchApiDataMock.mockRejectedValueOnce(new Error('s')).mockRejectedValueOnce(new Error('h'));

    const result = await fetchAdaptiveDashboardData(USER_ID);
    expect(result.subjects).toEqual([]);
    expect(result.sessionHistory).toEqual([]);
    expect(result.apiOnline).toBe(false);
    expect(result.initialErrorKey).toBe('connectionLimited');
  });

  it('keeps apiOnline true when only one of two endpoints fails (subjects ok, progress reject)', async () => {
    fetchApiDataMock
      .mockResolvedValueOnce(mockSubjectsResponse([subjectHistory({ job_id: 'only-subjects' })]))
      .mockRejectedValueOnce(new Error('history timeout'));

    const result = await fetchAdaptiveDashboardData(USER_ID);
    expect(result.apiOnline).toBe(true);
    expect(result.subjects).toEqual([subjectHistory({ job_id: 'only-subjects' })]);
    expect(result.sessionHistory).toEqual([]);
    expect(result.initialErrorKey).toBe('connectionLimited');
  });
});
