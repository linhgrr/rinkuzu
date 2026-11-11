import 'server-only';

import type {
  GuestDraftUpstream,
  UpstreamGuestDraft,
  UpstreamGuestDraftResult,
} from '@/interfaces/services/IGuestDraftService';
import {
  buildAdaptiveServiceHeaders,
  buildAdaptiveUrl,
  resolveAdaptiveProxyTimeoutMs,
} from '@/lib/adaptive/config';
import { logger } from '@/lib/logger';

const GUEST_DRAFTS_PATH = '/quiz/guest-drafts';
const GUEST_TEXT_DRAFTS_PATH = '/quiz/guest-drafts/text';

type Envelope = {
  data?: { draft?: UpstreamGuestDraft };
  error?: { code?: unknown; meta?: unknown };
};

async function readEnvelope(response: Response): Promise<Envelope> {
  try {
    return (await response.json()) as Envelope;
  } catch {
    return {};
  }
}

async function toResult(response: Response): Promise<UpstreamGuestDraftResult> {
  const body = await readEnvelope(response);
  const draft = body.data?.draft;
  if (response.ok && draft) return { ok: true, draft };
  const code = typeof body.error?.code === 'string' ? body.error.code : null;
  const meta =
    typeof body.error?.meta === 'object' && body.error.meta !== null
      ? (body.error.meta as Record<string, unknown>)
      : null;
  return { ok: false, status: response.ok ? 502 : response.status, code, meta };
}

async function call(
  path: string,
  init: RequestInit,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  // Service token only: the API refuses a guest call that carries a user id.
  return fetch(buildAdaptiveUrl(path), {
    ...init,
    headers: { ...buildAdaptiveServiceHeaders(), ...extraHeaders, accept: 'application/json' },
    signal: AbortSignal.timeout(resolveAdaptiveProxyTimeoutMs()),
    cache: 'no-store',
  });
}

const unavailable: UpstreamGuestDraftResult = {
  ok: false,
  status: 503,
  code: 'service_unavailable',
  meta: null,
};

/** The API owns a guest draft only while it extracts (RIN-1444); the draft id stays here. */
export function createGuestDraftUpstream(): GuestDraftUpstream {
  const draftPath = (id: string) => `${GUEST_DRAFTS_PATH}/${encodeURIComponent(id)}`;
  return {
    async create(pdf) {
      const form = new FormData();
      form.append('file', pdf, 'source.pdf');
      try {
        return await toResult(await call(GUEST_DRAFTS_PATH, { method: 'POST', body: form }));
      } catch (error) {
        logger.warn({ errorName: (error as Error).name }, 'Guest draft create call failed');
        return unavailable;
      }
    },
    async createFromText(text) {
      try {
        const response = await call(
          GUEST_TEXT_DRAFTS_PATH,
          { method: 'POST', body: JSON.stringify({ text }) },
          { 'content-type': 'application/json' },
        );
        return await toResult(response);
      } catch (error) {
        // The error name only: never the text.
        logger.warn({ errorName: (error as Error).name }, 'Guest text draft create call failed');
        return unavailable;
      }
    },
    async get(apiDraftId) {
      try {
        return await toResult(await call(draftPath(apiDraftId), { method: 'GET' }));
      } catch (error) {
        logger.warn({ errorName: (error as Error).name }, 'Guest draft status call failed');
        return unavailable;
      }
    },
    async remove(apiDraftId) {
      try {
        const response = await call(draftPath(apiDraftId), { method: 'DELETE' });
        if (!response.ok) logger.warn({ status: response.status }, 'Guest draft delete refused');
      } catch (error) {
        // The API's own TTL removes a draft whose delete was lost.
        logger.warn({ errorName: (error as Error).name }, 'Guest draft delete call failed');
      }
    },
  };
}
