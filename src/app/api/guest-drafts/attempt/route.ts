import { guestDraftAttemptRequestSchema } from '@/dtos/guest-draft';
import { getGuestDraftAttemptService } from '@/lib/guest-draft-factory';
import { guestDraftJsonRoute } from '@/lib/guest-draft/json-route';

export const dynamic = 'force-dynamic';

/**
 * A signed-out attempt on a ready guest draft (RIN-1446), scored on the server and stored
 * as a RIN-912 guest attempt: `GET /api/attempts/<id>` with the claim token shows the
 * result, and signing up claims it.
 */
export const POST = guestDraftJsonRoute(guestDraftAttemptRequestSchema, (body) =>
  getGuestDraftAttemptService().submit(body),
);
