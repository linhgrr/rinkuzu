import 'server-only';

import type { NextResponse } from 'next/server';

import type { GuestDraftStatusDto } from '@/dtos/guest-draft';
import type { GuestDraftResult } from '@/interfaces/services/IGuestDraftService';
import { apiErr, apiOk } from '@/lib/api/response';
import { GUEST_DRAFT_LIMIT_REASON } from '@/shared/constants/guest-draft';

/** Upstream fields the browser may see on a refused upload (the API's page and size caps). */
const FORWARDED_META_KEYS = ['reason', 'limit_pages', 'limit_mb'] as const;

function forwardedMeta(meta: Record<string, unknown> | null): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const key of FORWARDED_META_KEYS) {
    if (meta?.[key] !== undefined) picked[key] = meta[key];
  }
  return picked;
}

/** Maps a guest draft service result to the standard API envelope. */
export function guestDraftResponse(result: GuestDraftResult, successStatus = 200): NextResponse {
  if (result.ok) return apiOk<GuestDraftStatusDto>(result.draft, successStatus);
  switch (result.error) {
    case 'limit':
      // The UI shows "Sign up to create more" on this reason (spec AC3).
      return apiErr('rate_limit_exceeded', 'Guest draft limit reached', 429, {
        reason: GUEST_DRAFT_LIMIT_REASON,
        scope: result.scope,
        retryAfterSeconds: result.retryAfterSeconds,
      });
    case 'token_in_use':
      return apiErr('conflict', 'Guest draft token already used', 409);
    case 'not_found':
      return apiErr('not_found', 'Guest draft not found', 404);
    case 'upstream':
      if (result.status >= 400 && result.status < 500 && result.status !== 401) {
        return apiErr(
          result.code ?? 'validation_error',
          'Guest draft refused',
          result.status,
          forwardedMeta(result.meta),
        );
      }
      return apiErr('service_unavailable', 'Guest quiz is temporarily unavailable', 503, {
        retryable: true,
      });
  }
}
