import 'server-only';

import { z } from 'zod';

import {
  buildAdaptiveServiceHeaders,
  buildAdaptiveUrl,
  resolveAdaptiveProxyTimeoutMs,
} from '@/lib/adaptive/config';
import type { OutageNotifyList, OutageNotifyRow } from './outage-notify';

/**
 * Server-side client for the API's outage notify list (RIN-1650):
 * `GET /api/internal/outage-notify/pending`, `POST .../mark-sent` and
 * `GET .../stats`, all with the service token only.
 */

const BASE_PATH = '/internal/outage-notify';

const pendingSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(
      z.object({ id: z.string().min(1), email: z.string().min(3), locale: z.string() }),
    ),
  }),
});
const statsSchema = z.object({
  success: z.literal(true),
  data: z.object({ pending: z.number().int().nonnegative() }),
});
const markSentSchema = z.object({ success: z.literal(true) });

/** Thrown with a message that never carries the response body or an address. */
export class OutageNotifyUpstreamError extends Error {
  constructor(operation: string, reason: string) {
    super(`outage notify ${operation} failed: ${reason}`);
    this.name = 'OutageNotifyUpstreamError';
  }
}

async function call<T>(
  operation: string,
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(buildAdaptiveUrl(path), {
      ...init,
      headers: {
        ...buildAdaptiveServiceHeaders(),
        accept: 'application/json',
        ...(init.body ? { 'content-type': 'application/json' } : {}),
      },
      signal: AbortSignal.timeout(resolveAdaptiveProxyTimeoutMs()),
      cache: 'no-store',
    });
  } catch {
    throw new OutageNotifyUpstreamError(operation, 'network');
  }
  if (!response.ok) throw new OutageNotifyUpstreamError(operation, `status ${response.status}`);
  const parsed = schema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new OutageNotifyUpstreamError(operation, 'malformed body');
  return parsed.data;
}

export const outageNotifyApi: OutageNotifyList = {
  async pending(campaign: string, limit: number): Promise<OutageNotifyRow[]> {
    const query = new URLSearchParams({ campaign, limit: String(limit) });
    const body = await call('pending', `${BASE_PATH}/pending?${query.toString()}`, pendingSchema);
    return body.data.items;
  },
  async pendingCount(campaign: string): Promise<number> {
    const query = new URLSearchParams({ campaign });
    const body = await call('stats', `${BASE_PATH}/stats?${query.toString()}`, statsSchema);
    return body.data.pending;
  },
  async markSent(ids: readonly string[]): Promise<void> {
    await call('mark-sent', `${BASE_PATH}/mark-sent`, markSentSchema, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  },
};
