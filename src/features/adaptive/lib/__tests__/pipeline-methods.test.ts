import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fetchModule from '@/features/adaptive/lib/adaptive-api-fetch';
import {
  checkApiHealth,
  listPipelineJobs,
  retryPipelineJob,
  cancelPipelineJob,
} from '@/features/adaptive/lib/adaptive-api-methods';

describe('pipeline lifecycle methods', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('listPipelineJobs unwraps {jobs}', async () => {
    vi.spyOn(fetchModule, 'apiFetch').mockResolvedValue({
      jobs: [{ job_id: 'a' }],
      count: 1,
    } as never);
    expect(await listPipelineJobs()).toEqual([{ job_id: 'a' }]);
  });

  it('checkApiHealth caches successful health checks briefly', async () => {
    const spy = vi.spyOn(fetchModule, 'apiFetch').mockResolvedValue({} as never);
    expect(await checkApiHealth()).toBe(true);
    expect(spy).toHaveBeenCalledWith(
      '/api/adaptive/health',
      expect.objectContaining({ cache: 'no-store', cacheTtlMs: 10_000 }),
    );
  });

  it('retryPipelineJob POSTs the retry path', async () => {
    const spy = vi
      .spyOn(fetchModule, 'apiFetch')
      .mockResolvedValue({ job_id: 'a', status: 'queued' } as never);
    await retryPipelineJob('a');
    expect(spy).toHaveBeenCalledWith(
      '/api/adaptive/pipeline/jobs/a/retry',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('cancelPipelineJob POSTs the cancel path', async () => {
    const spy = vi
      .spyOn(fetchModule, 'apiFetch')
      .mockResolvedValue({ job_id: 'a', status: 'cancelling' } as never);
    await cancelPipelineJob('a');
    expect(spy).toHaveBeenCalledWith(
      '/api/adaptive/pipeline/jobs/a/cancel',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
