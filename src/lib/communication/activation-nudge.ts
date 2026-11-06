import 'server-only';

import type { Types } from 'mongoose';

import { fetchAdaptiveActivationEvents } from '@/lib/adaptive/activation-events';
import { captureServerEvent } from '@/lib/analytics/server';
import { logger } from '@/lib/logger';
import { ActivationNudgeRepository } from '@/repositories/ActivationNudgeRepository';
import { STARTER_QUIZ_ALLOWLIST } from '@/services/dashboard/starter-quizzes';
import {
  ACTIVATION_NUDGE_CAMPAIGN,
  activationNudgeCtaUrl,
  activationNudgeDedupeKey,
  activationNudgeFirstName,
  activationNudgeLocale,
  activationNudgeSendingEnabled,
  activationNudgeSignupWindow,
  decideActivationNudge,
  type ActivationNudgeSkipReason,
} from './activation-nudge-policy';
import {
  runActivationNudgeBackfill,
  type ActivationNudgeBackfillMode,
  type ActivationNudgeBackfillReport,
} from './activation-nudge-backfill';
import { siteUrl } from './internal';
import { communicationEnvironment } from './resend';
import {
  oneClickUnsubscribeUrl,
  unsubscribePageUrl,
  unsubscribeToken,
} from './review-reminder-policy';
import { renderActivationNudge } from './templates';

/** The all-zero actor the adaptive events endpoint accepts for service reads. */
const SERVICE_ACTOR_ID = '000000000000000000000000';
/** A send whose adaptive check cannot run is retried this much later. */
const ADAPTIVE_RETRY_MS = 30 * 60_000;
const SWEEP_LIMIT = 500;

const repository = new ActivationNudgeRepository();

/** Ids with an adaptive completion in `[from, to)`; `null` when the API cannot answer. */
async function adaptiveCompleters(from: Date, to: Date): Promise<Set<string> | null> {
  try {
    const learners = await fetchAdaptiveActivationEvents(from, to, SERVICE_ACTOR_ID);
    return new Set(
      learners
        .filter((learner) => learner.completions.length > 0)
        .map((learner) => learner.userId.toLowerCase()),
    );
  } catch {
    return null;
  }
}

/**
 * One sweep (every worker tick): enqueue one row per eligible learner who
 * signed up in `(now − 7 d, now − 24 h]`. Idempotent: a second sweep finds the
 * row and skips the learner, and the insert itself is keyed on the account.
 */
export async function sweepActivationNudges(
  now: Date = new Date(),
): Promise<{ enqueued: number; skipped: number }> {
  if (!activationNudgeSendingEnabled()) return { enqueued: 0, skipped: 0 };
  const window = activationNudgeSignupWindow(now);
  const learners = await repository.learnersSignedUpBetween(
    window.after,
    window.until,
    SWEEP_LIMIT,
  );
  if (learners.length === 0) return { enqueued: 0, skipped: 0 };
  const blockers = await repository.blockers(learners.map((learner) => learner.id));
  const candidates = learners.filter(
    (learner) => decideActivationNudge(learner, blockers, new Set(), now).decision === 'send',
  );
  // Asked only when someone is left; send time checks again, so an outage here is not fatal.
  const adaptive =
    candidates.length > 0
      ? ((await adaptiveCompleters(window.after, now)) ?? new Set<string>())
      : new Set<string>();
  let enqueued = 0;
  for (const learner of candidates) {
    const verdict = decideActivationNudge(learner, blockers, adaptive, now);
    // Activated through personalized learning only: no Attempt marks them, so
    // record a canceled row; the cheap checks then skip them on every later
    // tick instead of asking the adaptive API again for up to 6 days.
    if (verdict.decision === 'skip' && verdict.reason !== 'activated') continue;
    const inserted = await repository.enqueue({
      dedupeKey: activationNudgeDedupeKey(learner.id.toString()),
      userId: learner.id,
      to: learner.email,
      from: communicationEnvironment('SUPPORT_MAIL_FROM'),
      locale: activationNudgeLocale(learner.locale),
      trigger: '24h',
      availableAt: now,
      ...(verdict.decision === 'skip' ? { canceledReason: verdict.reason } : {}),
    });
    if (inserted && verdict.decision === 'send') enqueued += 1;
  }
  return { enqueued, skipped: learners.length - enqueued };
}

interface PreparedActivationNudge {
  subject: string;
  html: string;
  text: string;
  tags: Array<{ name: string; value: string }>;
  headers: Record<string, string>;
}

export type ActivationNudgePreparation =
  | { decision: 'send'; mail: PreparedActivationNudge }
  | { decision: 'retry'; availableAt: Date }
  | { decision: 'cancel'; reason: ActivationNudgeSkipReason };

/**
 * Send-time re-check and rendering for one claimed row: the learner may have
 * activated, unsubscribed or been excluded since the sweep.
 */
export async function prepareActivationNudge(
  item: {
    _id: Types.ObjectId;
    entityId: Types.ObjectId;
    locale?: string | null;
    trigger?: string | null;
  },
  now: Date = new Date(),
): Promise<ActivationNudgePreparation> {
  const learner = await repository.findLearner(item.entityId);
  if (!learner) return { decision: 'cancel', reason: 'user_missing' };
  const blockers = await repository.blockers([learner.id], item._id);
  const first = decideActivationNudge(learner, blockers, new Set(), now, item.trigger);
  if (first.decision === 'skip') return { decision: 'cancel', reason: first.reason };
  const adaptive = await adaptiveCompleters(learner.createdAt, now);
  if (!adaptive) {
    return { decision: 'retry', availableAt: new Date(now.getTime() + ADAPTIVE_RETRY_MS) };
  }
  const verdict = decideActivationNudge(learner, blockers, adaptive, now, item.trigger);
  if (verdict.decision === 'skip') return { decision: 'cancel', reason: verdict.reason };

  const locale = activationNudgeLocale(item.locale ?? learner.locale);
  const site = siteUrl();
  const userId = learner.id.toString();
  const token = unsubscribeToken(userId, communicationEnvironment('AUTH_SECRET'));
  const rendered = await renderActivationNudge({
    locale,
    firstName: activationNudgeFirstName(learner.name, locale),
    ctaUrl: activationNudgeCtaUrl({ siteUrl: site, locale, allowlist: STARTER_QUIZ_ALLOWLIST }),
    unsubscribeUrl: unsubscribePageUrl(site, locale, token),
  });
  return {
    decision: 'send',
    mail: {
      ...rendered,
      tags: [{ name: 'campaign', value: ACTIVATION_NUDGE_CAMPAIGN }],
      headers: {
        'List-Unsubscribe': `<${oneClickUnsubscribeUrl(site, token)}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    },
  };
}

/** `activation_email_sent` after the provider accepted the email; never fails the send. */
export async function recordActivationEmailSent(item: {
  userId?: Types.ObjectId | null;
  trigger?: string | null;
  locale?: string | null;
}): Promise<void> {
  if (!item.userId) return;
  const sent = await captureServerEvent('activation_email_sent', item.userId.toString(), {
    trigger: item.trigger ?? '24h',
    locale: activationNudgeLocale(item.locale),
  });
  if (!sent) logger.info({ event: 'activation_email_sent' }, 'Server analytics event not recorded');
}

/** The one-time backfill (RIN-1002) against the live collections; counts only. */
export async function backfillActivationNudges(
  mode: ActivationNudgeBackfillMode,
  now: Date = new Date(),
): Promise<ActivationNudgeBackfillReport> {
  return runActivationNudgeBackfill({
    mode,
    now,
    source: repository,
    adaptiveCompleters,
    from: communicationEnvironment('SUPPORT_MAIL_FROM'),
  });
}
