import 'server-only';

import { isRecord, isStandardSuccessEnvelope } from '@/lib/api/envelope';
import { logger } from '@/lib/logger';
import {
  listUnsettledLlmJobUsage,
  refundLlmJobUsage,
  settleLlmJobUsageOutcome,
} from '@/lib/llm/job-usage';
import type { LlmJobUsage, LlmUsageJobLink } from '@/lib/llm/rate-limit';
import { proxyAdaptiveRequest, type ProxyAuthContext } from './proxy';

/**
 * Settles `adaptive_pipeline` usage against the job it paid for.
 *
 * The unit is committed when `/pipeline/process` (or a retry) answers 202, but
 * the job runs afterwards. Policy, per job: only its latest attempt is charged,
 * and a failed latest attempt is not charged at all. A completed attempt keeps
 * the charge and is marked settled so it is not re-checked.
 *
 * Settlement runs wherever the web reads job status (the jobs routes), and on
 * the adaptive presigned-url quota check, so a learner who never polls still
 * gets the unit back before their next upload.
 */

const ACTION = 'adaptive_pipeline';
const RECONCILE_LOOKBACK_MS = 35 * 24 * 60 * 60 * 1000;
const RECONCILE_LIMIT = 5;
const RECONCILE_TIMEOUT_MS = 5_000;

interface PipelineJobSnapshot {
  jobId: string;
  status: string;
  attempt: number;
}

function toJobSnapshot(value: unknown): PipelineJobSnapshot | null {
  if (!isRecord(value)) return null;
  const jobId = value['job_id'];
  const status = value['status'];
  const retryCount = value['retry_count'];
  if (typeof jobId !== 'string' || !jobId || typeof status !== 'string') return null;
  const attempt = Number.isInteger(retryCount) && (retryCount as number) >= 0 ? retryCount : 0;
  return { jobId, status, attempt: attempt as number };
}

function jobSnapshots(payload: unknown): PipelineJobSnapshot[] {
  if (!isStandardSuccessEnvelope<unknown>(payload)) return [];
  const data = payload.data;
  const items = isRecord(data) && Array.isArray(data['jobs']) ? data['jobs'] : [data];
  return items.flatMap((item) => toJobSnapshot(item) ?? []);
}

/** Proxy hook: the job a 202 from `/pipeline/process` or `/retry` accepted. */
export function pipelineJobLinkFromEnvelope(payload: unknown): LlmUsageJobLink | null {
  const [job] = jobSnapshots(payload);
  return job ? { jobId: job.jobId, jobAttempt: job.attempt } : null;
}

async function settleJob(
  userId: string,
  job: PipelineJobSnapshot,
  charged: readonly LlmJobUsage[],
): Promise<void> {
  for (const usage of charged) {
    if (usage.jobId !== job.jobId || usage.jobAttempt > job.attempt) continue;
    if (usage.jobAttempt < job.attempt) {
      await refundLlmJobUsage(userId, ACTION, usage.requestId, 'superseded');
    } else if (job.status === 'failed') {
      await refundLlmJobUsage(userId, ACTION, usage.requestId, 'failed');
    } else if (job.status === 'completed') {
      await settleLlmJobUsageOutcome(userId, ACTION, usage.requestId, 'completed');
    }
    // A cancelled attempt keeps its charge but stays unsettled: the API allows
    // retrying it, and the retry then supersedes it.
  }
}

function meteredUser(auth: ProxyAuthContext): string | null {
  return auth.userId && auth.userRole !== 'admin' ? auth.userId : null;
}

/**
 * Reads job status out of a proxied jobs response (list or single) and settles
 * any charged job it shows. Never consumes the response and never throws.
 */
export async function settlePipelineUsageFromResponse(
  response: Response,
  auth: ProxyAuthContext,
): Promise<void> {
  const userId = meteredUser(auth);
  if (!userId || !response.ok) return;
  try {
    const jobs = jobSnapshots(await response.clone().json());
    if (jobs.length === 0) return;
    const charged = await listUnsettledLlmJobUsage(userId, ACTION);
    if (charged.length === 0) return;
    for (const job of jobs) await settleJob(userId, job, charged);
  } catch (error) {
    logger.warn({ error }, 'Adaptive pipeline usage settlement failed');
  }
}

/**
 * Looks up every recent charged job whose outcome is still unknown and settles
 * it. Bounded (a few jobs, short timeout) and never throws: a failure here only
 * means the refund waits for the next read.
 */
export async function reconcilePipelineUsage(auth: ProxyAuthContext): Promise<void> {
  const userId = meteredUser(auth);
  if (!userId) return;
  try {
    const charged = await listUnsettledLlmJobUsage(userId, ACTION, {
      since: new Date(Date.now() - RECONCILE_LOOKBACK_MS),
      limit: RECONCILE_LIMIT,
    });
    const jobIds = [...new Set(charged.map((usage) => usage.jobId))];
    for (const jobId of jobIds) {
      const response = await proxyAdaptiveRequest(
        new Request(`http://internal/api/adaptive/pipeline/jobs/${encodeURIComponent(jobId)}`),
        `/pipeline/jobs/${encodeURIComponent(jobId)}`,
        auth,
        { method: 'GET', timeoutMs: RECONCILE_TIMEOUT_MS },
      );
      if (response.status === 404) {
        for (const usage of charged.filter((item) => item.jobId === jobId)) {
          await settleLlmJobUsageOutcome(userId, ACTION, usage.requestId, 'missing');
        }
        continue;
      }
      if (!response.ok) continue;
      for (const job of jobSnapshots(await response.json())) {
        await settleJob(userId, job, charged);
      }
    }
  } catch (error) {
    logger.warn({ error }, 'Adaptive pipeline usage reconciliation failed');
  }
}
