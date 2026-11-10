import { guestDraftTokenRequestSchema } from '@/dtos/guest-draft';
import { getGuestDraftAttemptService } from '@/lib/guest-draft-factory';
import { guestDraftJsonRoute } from '@/lib/guest-draft/json-route';

export const dynamic = 'force-dynamic';

/** The questions of a ready guest draft (RIN-1446), without answers; 404 until ready. */
export const POST = guestDraftJsonRoute(guestDraftTokenRequestSchema, ({ token }) =>
  getGuestDraftAttemptService().play(token),
);
