import 'server-only';

import { logger } from '@/lib/logger';
import type { AnalyticsEventName } from './events';

type ServerEventProperties = Record<string, string | number | boolean | null>;

const CAPTURE_TIMEOUT_MS = 3_000;

/**
 * Server-side product event (RIN-999): one PostHog capture keyed on the
 * learner's id, the same distinct id the browser identifies with. Best
 * effort: it never throws, and a missing project token skips it. Callers pass
 * only non-personal properties; nothing here is logged but the event name.
 */
export async function captureServerEvent(
  event: AnalyticsEventName,
  distinctId: string,
  properties: ServerEventProperties,
  env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<boolean> {
  const token = env['NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN']?.trim();
  if (!token) return false;
  const host = (env['NEXT_PUBLIC_POSTHOG_HOST'] ?? 'https://us.i.posthog.com').replace(/\/$/u, '');
  try {
    const response = await fetch(`${host}/i/v0/e/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: token,
        event,
        distinct_id: distinctId,
        properties: { ...properties, $lib: 'rinkuzu-server' },
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(CAPTURE_TIMEOUT_MS),
    });
    if (!response.ok) {
      logger.warn({ event, status: response.status }, 'Server analytics capture rejected');
    }
    return response.ok;
  } catch {
    logger.warn({ event }, 'Server analytics capture failed');
    return false;
  }
}

/**
 * A server event that must not be tied to a learner (RIN-1269): a fresh random
 * distinct id per event, and `$process_person_profile: false` so PostHog
 * creates no person for it. Same best-effort contract as `captureServerEvent`.
 */
export function captureAnonymousServerEvent(
  event: AnalyticsEventName,
  properties: ServerEventProperties,
  env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<boolean> {
  return captureServerEvent(
    event,
    crypto.randomUUID(),
    { ...properties, $process_person_profile: false },
    env,
  );
}
