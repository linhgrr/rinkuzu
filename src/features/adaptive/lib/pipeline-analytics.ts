import { capturePipelineTerminalEventOnce, getAnalyticsConsent } from '@/lib/analytics/client';
import type { PipelineJobListItem } from '@/features/adaptive/types/pipeline';

// Jobs this browser submitted, so only one device reports a job's outcome and
// the terminal event can carry the upload's journey_id.
const TRACKED_JOBS_STORAGE_KEY = 'rinkuzu_analytics_adaptive_jobs_v1';
const MAX_TRACKED_JOBS = 50;

type TrackedJobs = Record<string, { journeyId: string; trackedAt: number }>;

type TerminalJobFields = Pick<
  PipelineJobListItem,
  'job_id' | 'status' | 'error_code' | 'retry_count' | 'created_at' | 'updated_at'
>;

function isTrackedJob(value: unknown): value is TrackedJobs[string] {
  if (!value || typeof value !== 'object') return false;
  const { journeyId, trackedAt } = value as Record<string, unknown>;
  return typeof journeyId === 'string' && typeof trackedAt === 'number';
}

function readTrackedJobs(): TrackedJobs {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(TRACKED_JOBS_STORAGE_KEY) ?? '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, TrackedJobs[string]] =>
        isTrackedJob(entry[1]),
      ),
    );
  } catch {
    return {};
  }
}

export function trackAdaptivePipelineJob(jobId: string, journeyId: string): void {
  if (getAnalyticsConsent() !== 'granted') return;
  const entries = Object.entries({
    ...readTrackedJobs(),
    [jobId]: { journeyId, trackedAt: Date.now() },
  })
    .sort(([, a], [, b]) => b.trackedAt - a.trackedAt)
    .slice(0, MAX_TRACKED_JOBS);
  localStorage.setItem(TRACKED_JOBS_STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
}

/**
 * Reports `pipeline_completed` / `pipeline_failed` when a job this browser
 * submitted reaches a terminal status. Safe to call on every poll.
 */
export function reportAdaptivePipelineTerminal(job: TerminalJobFields): void {
  if (job.status !== 'completed' && job.status !== 'failed' && job.status !== 'cancelled') return;
  const tracked = readTrackedJobs()[job.job_id];
  if (!tracked) return;

  const durationMs =
    job.created_at > 0 && job.updated_at >= job.created_at
      ? (job.updated_at - job.created_at) * 1000
      : null;
  capturePipelineTerminalEventOnce({
    path: 'adaptive',
    // A retried job runs again, so each attempt reports its own outcome.
    runKey: `${job.job_id}:${job.retry_count}`,
    outcome: job.status === 'completed' ? 'completed' : 'failed',
    errorCode:
      job.status === 'cancelled' ? (job.error_code ?? 'pipeline_cancelled') : job.error_code,
    journeyId: tracked.journeyId,
    durationMs,
  });
}

export function reportAdaptivePipelineTerminals(jobs: readonly TerminalJobFields[]): void {
  for (const job of jobs) reportAdaptivePipelineTerminal(job);
}
