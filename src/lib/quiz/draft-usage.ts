import 'server-only';

import { proxyAdaptiveRequest, type ProxyAuthContext } from '@/lib/adaptive/proxy';
import { isRecord, isStandardSuccessEnvelope } from '@/lib/api/envelope';
import { logger } from '@/lib/logger';
import {
  listRecentUnsettledLlmJobUsage,
  listUnsettledLlmJobUsage,
  refundLlmJobUsage,
  settleLlmJobUsageOutcome,
} from '@/lib/llm/job-usage';
import type { LlmJobUsage, LlmUsageJobLink } from '@/lib/llm/rate-limit';

/**
 * Settles `quiz_extract` usage against the draft it paid for (RIN-596).
 *
 * The unit is committed when `POST /quiz/drafts` answers 2xx, but extraction
 * runs afterwards. Policy, per draft: a `failed` draft is not charged; a draft
 * that produced questions (`completed`, `submitted`) keeps the charge; a draft
 * the learner deleted mid-extraction (`cancelled`) keeps it too. Each settled
 * unit is marked so it is not re-checked. The API has no re-extract endpoint,
 * so a draft is only ever charged by its own POST (attempt 0).
 *
 * Settlement runs wherever the web reads drafts (list, single draft, before a
 * delete) and on the quota checks, so a learner who never reopens a failed
 * draft still gets the unit back before their next upload.
 */

const ACTION = 'quiz_extract';
const LOOKUP_TIMEOUT_MS = 5_000;

interface QuizDraftSnapshot {
  draftId: string;
  status: string;
}

function toDraftSnapshot(value: unknown): QuizDraftSnapshot | null {
  if (!isRecord(value)) return null;
  const draftId = value['draft_id'];
  const status = value['status'];
  if (typeof draftId !== 'string' || !draftId || typeof status !== 'string') return null;
  return { draftId, status };
}

function draftSnapshots(payload: unknown): QuizDraftSnapshot[] {
  if (!isStandardSuccessEnvelope<unknown>(payload) || !isRecord(payload.data)) return [];
  const data = payload.data;
  const items = Array.isArray(data['drafts']) ? data['drafts'] : [data['draft']];
  return items.flatMap((item) => toDraftSnapshot(item) ?? []);
}

/** Proxy hook: the draft a `POST /quiz/drafts` created. */
export function quizDraftJobLinkFromEnvelope(payload: unknown): LlmUsageJobLink | null {
  const [draft] = draftSnapshots(payload);
  return draft ? { jobId: draft.draftId, jobAttempt: 0 } : null;
}

async function settleDraft(
  userId: string,
  draft: QuizDraftSnapshot,
  charged: readonly LlmJobUsage[],
): Promise<void> {
  for (const usage of charged) {
    if (usage.jobId !== draft.draftId) continue;
    if (draft.status === 'failed') {
      await refundLlmJobUsage(userId, ACTION, usage.requestId, 'failed');
    } else if (draft.status === 'completed' || draft.status === 'submitted') {
      await settleLlmJobUsageOutcome(userId, ACTION, usage.requestId, 'completed');
    } else if (draft.status === 'cancelled') {
      await settleLlmJobUsageOutcome(userId, ACTION, usage.requestId, 'cancelled');
    } else if (draft.status === 'expired') {
      // Expiry hides how extraction ended; without proof of failure, keep it.
      await settleLlmJobUsageOutcome(userId, ACTION, usage.requestId, 'missing');
    }
    // queued / processing: still running, keep the charge and check again later.
  }
}

function meteredUser(auth: ProxyAuthContext): string | null {
  return auth.userId && auth.userRole !== 'admin' ? auth.userId : null;
}

/**
 * Reads draft status out of a proxied drafts response (list or single) and
 * settles any charged draft it shows. Never consumes the response and never
 * throws.
 */
export async function settleQuizDraftUsageFromResponse(
  response: Response,
  auth: ProxyAuthContext,
): Promise<void> {
  const userId = meteredUser(auth);
  if (!userId || !response.ok) return;
  try {
    const drafts = draftSnapshots(await response.clone().json());
    if (drafts.length === 0) return;
    const charged = await listUnsettledLlmJobUsage(userId, ACTION);
    if (charged.length === 0) return;
    for (const draft of drafts) await settleDraft(userId, draft, charged);
  } catch (error) {
    logger.warn({ error }, 'Quiz draft usage settlement failed');
  }
}

async function settleDraftById(
  userId: string,
  draftId: string,
  charged: readonly LlmJobUsage[],
  auth: ProxyAuthContext,
): Promise<void> {
  const path = `/quiz/drafts/${encodeURIComponent(draftId)}`;
  const response = await proxyAdaptiveRequest(
    new Request(`http://internal/api/quiz-drafts/${encodeURIComponent(draftId)}`),
    path,
    auth,
    { method: 'GET', timeoutMs: LOOKUP_TIMEOUT_MS },
  );
  if (response.status === 404) {
    // Gone before we saw it end: we cannot prove it failed, so keep the charge.
    for (const usage of charged.filter((item) => item.jobId === draftId)) {
      await settleLlmJobUsageOutcome(userId, ACTION, usage.requestId, 'missing');
    }
    return;
  }
  if (!response.ok) return;
  for (const draft of draftSnapshots(await response.json())) {
    await settleDraft(userId, draft, charged);
  }
}

/**
 * Settles one draft before it is deleted. Deleting removes the draft, so a
 * failed draft the learner never reopened would otherwise lose its refund.
 * Bounded and never throws.
 */
export async function settleQuizDraftUsageBeforeDelete(
  draftId: string,
  auth: ProxyAuthContext,
): Promise<void> {
  const userId = meteredUser(auth);
  if (!userId) return;
  try {
    const charged = (await listUnsettledLlmJobUsage(userId, ACTION)).filter(
      (usage) => usage.jobId === draftId,
    );
    if (charged.length === 0) return;
    await settleDraftById(userId, draftId, charged, auth);
  } catch (error) {
    logger.warn({ error }, 'Quiz draft usage settlement before delete failed');
  }
}

/**
 * Looks up every recent charged draft whose outcome is still unknown and
 * settles it. Bounded (a few drafts, short timeout) and never throws: a failure
 * here only means the refund waits for the next read.
 */
export async function reconcileQuizDraftUsage(auth: ProxyAuthContext): Promise<void> {
  const userId = meteredUser(auth);
  if (!userId) return;
  try {
    const charged = await listRecentUnsettledLlmJobUsage(userId, ACTION);
    const draftIds = [...new Set(charged.map((usage) => usage.jobId))];
    for (const draftId of draftIds) await settleDraftById(userId, draftId, charged, auth);
  } catch (error) {
    logger.warn({ error }, 'Quiz draft usage reconciliation failed');
  }
}
