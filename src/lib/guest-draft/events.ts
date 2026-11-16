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
 * without a person profile. Properties are locale, entry, source (`pdf` or `text`,
 * RIN-1538, `image` RIN-1792 with `page_count`), the failure reason code and, on first_batch_ready, `ms_since_submit`
 * RIN-1538), `file_type` (`docx` or `pptx`, only on a draft made from a Word or PowerPoint
 * file, RIN-1786), the failure reason code and, on first_batch_ready, `ms_since_submit`
 * (RIN-1619): never a file name, content (file or pasted text), IP or token.
 */
export function createGuestDraftEvents(capture: Capture = captureServerEvent): GuestDraftEvents {
  const send = async (
    event: AnalyticsEventName,
    { draftId, locale, entry, source, pageCount, fileType }: GuestDraftEventContext,
    extra: Record<string, string | number> = {},
  ) => {
    await capture(event, `guest_draft:${draftId}`, {
      locale,
      entry,
      source,
      ...(pageCount ? { page_count: pageCount } : {}),
      ...(fileType ? { file_type: fileType } : {}),
      ...extra,
      $process_person_profile: false,
      $geoip_disable: true,
    });
  };
  return {
    started: (context) => send('guest_draft_started', context),
    firstBatchReady: (context, msSinceSubmit) =>
      send('guest_draft_first_batch_ready', context, { ms_since_submit: msSinceSubmit }),
    ready: (context) => send('guest_draft_ready', context),
    failed: (context, reason) => send('guest_draft_failed', context, { reason }),
    claimed: (context) => send('guest_draft_claimed', context),
  };
}
