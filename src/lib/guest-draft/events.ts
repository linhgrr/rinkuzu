import 'server-only';

import type {
  GuestDraftEventContext,
  GuestDraftEvents,
} from '@/interfaces/services/IGuestDraftService';
import type { AnalyticsEventName } from '@/lib/analytics/events';
import { captureServerEvent } from '@/lib/analytics/server';

type Capture = typeof captureServerEvent;

/**
 * guest_draft_* events (spec AC7), sent from the server so consent gating cannot lose
 * them. The distinct id is the guest draft's own id, which links started → ready/failed
 * without a person profile. Properties are locale, entry, source (`pdf` or
 * `text`, RIN-1538) and the failure reason code: never a file name, content (file or pasted
 * text), IP or token.
 */
export function createGuestDraftEvents(capture: Capture = captureServerEvent): GuestDraftEvents {
  const send = async (
    event: AnalyticsEventName,
    { draftId, locale, entry, source }: GuestDraftEventContext,
    extra: Record<string, string> = {},
  ) => {
    await capture(event, `guest_draft:${draftId}`, {
      locale,
      entry,
      source,
      ...extra,
      $process_person_profile: false,
      $geoip_disable: true,
    });
  };
  return {
    started: (context) => send('guest_draft_started', context),
    ready: (context) => send('guest_draft_ready', context),
    failed: (context, reason) => send('guest_draft_failed', context, { reason }),
    claimed: (context) => send('guest_draft_claimed', context),
  };
}
