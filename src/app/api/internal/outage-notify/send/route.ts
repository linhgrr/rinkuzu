import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { hasCronSecretBearer } from '@/lib/api/cron-secret-auth';
import { readAndValidateSearchParams } from '@/lib/api/request';
import { apiErr, apiOk } from '@/lib/api/response';
import { siteUrl } from '@/lib/communication/internal';
import { outageNotifyCampaign, runOutageNotifySend } from '@/lib/communication/outage-notify';
import {
  OutageNotifyUpstreamError,
  outageNotifyApi,
} from '@/lib/communication/outage-notify-upstream';
import { communicationEnvironment, sendCommunicationEmail } from '@/lib/communication/resend';
import { getStarterQuizHref } from '@/lib/dashboard-factory';
import { logger } from '@/lib/logger';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/** Any `?dryRun` value is a dry run, so `dryRun=true` never sends by mistake. */
const sendQuerySchema = z.object({ dryRun: z.string().max(8).optional() });

/** Below `maxDuration`, so the last mark-sent and the count still fit. */
const SEND_BUDGET_MS = 50_000;
/** About 2 sends a second, under Resend's default team rate limit. */
const SEND_INTERVAL_MS = 550;

/**
 * One-off "Rinkuzu is back" send (RIN-1653): SRE calls it with
 * `Authorization: Bearer <CRON_SECRET>` once the site is back, and again while
 * `remaining` is above 0. `?dryRun=1` only counts. Answers counts only.
 */
export async function POST(request: NextRequest): Promise<Response> {
  if (!hasCronSecretBearer(request)) {
    return apiErr('unauthorized', 'Invalid credentials', 401);
  }
  const query = readAndValidateSearchParams(request, sendQuerySchema);
  if (!query.success) return apiErr('validation_error', 'Invalid query', 400);
  const dryRun = query.data.dryRun !== undefined;
  try {
    const result = await runOutageNotifySend(
      {
        list: outageNotifyApi,
        starterHref: getStarterQuizHref,
        send: sendCommunicationEmail,
        from: communicationEnvironment('SUPPORT_MAIL_FROM'),
        siteUrl: siteUrl(),
        now: Date.now,
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      },
      {
        campaign: outageNotifyCampaign(process.env['OUTAGE_NOTIFY_CAMPAIGN']),
        dryRun,
        budgetMs: SEND_BUDGET_MS,
        sendIntervalMs: SEND_INTERVAL_MS,
      },
    );
    return apiOk(result);
  } catch (error) {
    // Messages here never carry an address: the client's errors name only the step.
    const upstream = error instanceof OutageNotifyUpstreamError;
    logger.error(
      { reason: error instanceof Error ? error.message : 'unknown' },
      'Outage notify send failed',
    );
    return upstream
      ? apiErr('upstream_error', 'Outage notify list unavailable', 502)
      : apiErr('internal_error', 'Outage notify send failed', 500);
  }
}
