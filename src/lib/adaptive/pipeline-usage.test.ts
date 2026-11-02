import { beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory stand-in for the usage ledger: committed job-linked records, and
// the same "settle once" guard the Mongo implementation enforces with a
// conditional status update.
const ledger = vi.hoisted(() => {
  type Row = {
    userId: string;
    requestId: string;
    jobId: string;
    jobAttempt: number;
    status: 'committed' | 'refunded';
    jobOutcome?: string;
  };
  const rows: Row[] = [];
  return {
    rows,
    listUnsettledLlmJobUsage: vi.fn(async (userId: string) =>
      rows
        .filter((row) => row.userId === userId && row.status === 'committed' && !row.jobOutcome)
        .map(({ requestId, jobId, jobAttempt }) => ({ requestId, jobId, jobAttempt })),
    ),
    refundLlmJobUsage: vi.fn(
      async (userId: string, _action: string, requestId: string, outcome: string) => {
        const row = rows.find(
          (item) =>
            item.userId === userId && item.requestId === requestId && item.status === 'committed',
        );
        if (!row) return false;
        row.status = 'refunded';
        row.jobOutcome = outcome;
        return true;
      },
    ),
    settleLlmJobUsageOutcome: vi.fn(
      async (userId: string, _action: string, requestId: string, outcome: string) => {
        const row = rows.find(
          (item) =>
            item.userId === userId && item.requestId === requestId && item.status === 'committed',
        );
        if (row && !row.jobOutcome) row.jobOutcome = outcome;
      },
    ),
  };
});

const proxyMock = vi.hoisted(() => vi.fn());
const loggerWarn = vi.hoisted(() => vi.fn());

vi.mock('@/lib/llm/job-usage', () => ({
  listUnsettledLlmJobUsage: ledger.listUnsettledLlmJobUsage,
  refundLlmJobUsage: ledger.refundLlmJobUsage,
  settleLlmJobUsageOutcome: ledger.settleLlmJobUsageOutcome,
}));
vi.mock('@/lib/adaptive/proxy', () => ({ proxyAdaptiveRequest: proxyMock }));
vi.mock('@/lib/logger', () => ({ logger: { warn: loggerWarn, error: vi.fn() } }));

import {
  pipelineJobLinkFromEnvelope,
  reconcilePipelineUsage,
  settlePipelineUsageFromResponse,
} from './pipeline-usage';

const learner = { userId: 'learner-1', userRole: 'user' as const };

function charge(requestId: string, jobId: string, jobAttempt = 0) {
  ledger.rows.push({
    userId: learner.userId,
    requestId,
    jobId,
    jobAttempt,
    status: 'committed',
  });
}

function job(jobId: string, status: string, retryCount = 0) {
  return { job_id: jobId, status, retry_count: retryCount, filename: 'notes.pdf' };
}

function listResponse(...jobs: ReturnType<typeof job>[]) {
  return Response.json({ success: true, data: { jobs, count: jobs.length } });
}

function singleResponse(item: ReturnType<typeof job>) {
  return Response.json({ success: true, data: item });
}

describe('adaptive pipeline usage settlement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ledger.rows.length = 0;
  });

  it('refunds the unit once when the job fails, across repeated polls', async () => {
    charge('upload-1', 'job-1');

    await settlePipelineUsageFromResponse(listResponse(job('job-1', 'failed')), learner);
    await settlePipelineUsageFromResponse(listResponse(job('job-1', 'failed')), learner);
    await settlePipelineUsageFromResponse(singleResponse(job('job-1', 'failed')), learner);

    expect(ledger.refundLlmJobUsage).toHaveBeenCalledOnce();
    expect(ledger.refundLlmJobUsage).toHaveBeenCalledWith(
      'learner-1',
      'adaptive_pipeline',
      'upload-1',
      'failed',
    );
    expect(ledger.rows[0]).toMatchObject({ status: 'refunded', jobOutcome: 'failed' });
  });

  it('keeps the charge for a completed job and stops tracking it', async () => {
    charge('upload-2', 'job-2');

    await settlePipelineUsageFromResponse(listResponse(job('job-2', 'completed')), learner);
    await settlePipelineUsageFromResponse(listResponse(job('job-2', 'completed')), learner);

    expect(ledger.refundLlmJobUsage).not.toHaveBeenCalled();
    expect(ledger.settleLlmJobUsageOutcome).toHaveBeenCalledOnce();
    expect(ledger.rows[0]).toMatchObject({ status: 'committed', jobOutcome: 'completed' });
  });

  it('does not settle a job that is still running', async () => {
    charge('upload-3', 'job-3');

    await settlePipelineUsageFromResponse(listResponse(job('job-3', 'extracting')), learner);

    expect(ledger.refundLlmJobUsage).not.toHaveBeenCalled();
    expect(ledger.settleLlmJobUsageOutcome).not.toHaveBeenCalled();
    expect(ledger.rows[0]).toMatchObject({ status: 'committed' });
    expect(ledger.rows[0]?.jobOutcome).toBeUndefined();
  });

  it('charges a retried job once: the superseded attempt is refunded, the latest counts', async () => {
    charge('upload-4', 'job-4', 0);
    charge('retry-4', 'job-4', 1);

    await settlePipelineUsageFromResponse(listResponse(job('job-4', 'queued', 1)), learner);
    await settlePipelineUsageFromResponse(listResponse(job('job-4', 'completed', 1)), learner);

    expect(ledger.rows.find((row) => row.requestId === 'upload-4')).toMatchObject({
      status: 'refunded',
      jobOutcome: 'superseded',
    });
    expect(ledger.rows.find((row) => row.requestId === 'retry-4')).toMatchObject({
      status: 'committed',
      jobOutcome: 'completed',
    });
  });

  it('keeps a cancelled attempt charged until a retry supersedes it', async () => {
    charge('upload-14', 'job-14', 0);

    await settlePipelineUsageFromResponse(listResponse(job('job-14', 'cancelled', 0)), learner);
    expect(ledger.rows[0]).toMatchObject({ status: 'committed' });
    expect(ledger.rows[0]?.jobOutcome).toBeUndefined();

    charge('retry-14', 'job-14', 1);
    await settlePipelineUsageFromResponse(listResponse(job('job-14', 'completed', 1)), learner);

    expect(ledger.rows.map((row) => [row.requestId, row.status, row.jobOutcome])).toEqual([
      ['upload-14', 'refunded', 'superseded'],
      ['retry-14', 'committed', 'completed'],
    ]);
  });

  it('ignores a stale failed poll of an earlier attempt once a retry is charged', async () => {
    charge('upload-5', 'job-5', 0);
    await settlePipelineUsageFromResponse(listResponse(job('job-5', 'failed', 0)), learner);
    charge('retry-5', 'job-5', 1);

    // A poll that read the job before the retry transitioned it.
    await settlePipelineUsageFromResponse(listResponse(job('job-5', 'failed', 0)), learner);

    expect(ledger.rows.find((row) => row.requestId === 'retry-5')).toMatchObject({
      status: 'committed',
    });
  });

  it('does nothing for admins, failed responses, or users without job-linked usage', async () => {
    charge('upload-6', 'job-6');

    await settlePipelineUsageFromResponse(listResponse(job('job-6', 'failed')), {
      userId: learner.userId,
      userRole: 'admin',
    });
    await settlePipelineUsageFromResponse(
      Response.json({ success: false, error: { code: 'not_found' } }, { status: 404 }),
      learner,
    );
    await settlePipelineUsageFromResponse(listResponse(job('job-6', 'failed')), {
      userId: 'someone-else',
      userRole: 'user',
    });

    expect(ledger.refundLlmJobUsage).not.toHaveBeenCalled();
    expect(ledger.rows[0]).toMatchObject({ status: 'committed' });
  });

  it('never fails the read when the ledger is unavailable', async () => {
    ledger.listUnsettledLlmJobUsage.mockRejectedValueOnce(new Error('db down'));
    const response = listResponse(job('job-7', 'failed'));

    await expect(settlePipelineUsageFromResponse(response, learner)).resolves.toBeUndefined();
    await expect(response.json()).resolves.toMatchObject({ success: true });
    expect(loggerWarn).toHaveBeenCalledOnce();
  });

  describe('reconcilePipelineUsage (no polling needed)', () => {
    it('fetches each unsettled job and refunds the failed one', async () => {
      charge('upload-8', 'job-8');
      charge('upload-9', 'job-9');
      proxyMock.mockImplementation(async (_req: Request, path: string) =>
        path === '/pipeline/jobs/job-8'
          ? singleResponse(job('job-8', 'failed'))
          : singleResponse(job('job-9', 'completed')),
      );

      await reconcilePipelineUsage(learner);
      await reconcilePipelineUsage(learner);

      expect(proxyMock).toHaveBeenCalledTimes(2);
      expect(proxyMock).toHaveBeenCalledWith(
        expect.any(Request),
        '/pipeline/jobs/job-8',
        learner,
        expect.objectContaining({ method: 'GET' }),
      );
      expect(ledger.refundLlmJobUsage).toHaveBeenCalledOnce();
      expect(ledger.rows.map((row) => [row.requestId, row.status, row.jobOutcome])).toEqual([
        ['upload-8', 'refunded', 'failed'],
        ['upload-9', 'committed', 'completed'],
      ]);
    });

    it('marks a job the service no longer knows as settled without refunding it', async () => {
      charge('upload-10', 'job-10');
      proxyMock.mockResolvedValue(
        Response.json({ success: false, error: { code: 'not_found' } }, { status: 404 }),
      );

      await reconcilePipelineUsage(learner);

      expect(ledger.refundLlmJobUsage).not.toHaveBeenCalled();
      expect(ledger.rows[0]).toMatchObject({ status: 'committed', jobOutcome: 'missing' });
    });

    it('skips admins and swallows upstream errors', async () => {
      charge('upload-11', 'job-11');
      await reconcilePipelineUsage({ userId: learner.userId, userRole: 'admin' });
      expect(proxyMock).not.toHaveBeenCalled();

      proxyMock.mockRejectedValue(new Error('network'));
      await expect(reconcilePipelineUsage(learner)).resolves.toBeUndefined();
      expect(ledger.rows[0]).toMatchObject({ status: 'committed' });
    });
  });

  describe('pipelineJobLinkFromEnvelope', () => {
    it('reads job id and attempt from an accepted envelope', () => {
      expect(
        pipelineJobLinkFromEnvelope({
          success: true,
          data: { job_id: 'job-12', status: 'queued', retry_count: 2 },
        }),
      ).toEqual({ jobId: 'job-12', jobAttempt: 2 });
      expect(
        pipelineJobLinkFromEnvelope({
          success: true,
          data: { job_id: 'job-13', status: 'queued' },
        }),
      ).toEqual({ jobId: 'job-13', jobAttempt: 0 });
    });

    it('returns null for anything that is not an accepted job', () => {
      expect(pipelineJobLinkFromEnvelope(null)).toBeNull();
      expect(pipelineJobLinkFromEnvelope({ success: true, data: { status: 'queued' } })).toBeNull();
      expect(pipelineJobLinkFromEnvelope({ success: false, error: {} })).toBeNull();
    });
  });
});
