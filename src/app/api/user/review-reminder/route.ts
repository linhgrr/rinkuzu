import type { NextRequest } from 'next/server';
import { reviewReminderRequestSchema } from '@/dtos/communication';
import { withAuth } from '@/lib/api/auth';
import { apiOk } from '@/lib/api/response';
import { parseJsonBody } from '@/lib/api/validated';
import { extractRequestContext } from '@/lib/audit';
import {
  assertCommunicationMutationRequest,
  communicationHttpError,
} from '@/lib/communication/http';
import { optInReviewReminder, optOutReviewReminder } from '@/lib/communication/review-reminder';

/**
 * Result-page opt-in to the 2-day review email (RIN-911 AC3/AC4).
 * `POST { attemptId, optIn?, locale? }`: `optIn: false` un-ticks it.
 * `DELETE { attemptId }` un-ticks it too.
 */
export const POST = withAuth(async (request: NextRequest, { userId, email }) => {
  try {
    assertCommunicationMutationRequest(request);
    const input = await parseJsonBody(request, reviewReminderRequestSchema);
    if (!input.ok) return input.response;
    const { ip } = extractRequestContext(request);
    if (!input.data.optIn) {
      return apiOk(await optOutReviewReminder({ userId, source: 'result_page_review', ip }));
    }
    return apiOk(
      await optInReviewReminder({
        userId,
        email,
        attemptId: input.data.attemptId,
        locale: input.data.locale,
        ip,
      }),
    );
  } catch (error) {
    return communicationHttpError(error, 'review-reminder-update');
  }
});

export const DELETE = withAuth(async (request: NextRequest, { userId }) => {
  try {
    assertCommunicationMutationRequest(request);
    const input = await parseJsonBody(request, reviewReminderRequestSchema);
    if (!input.ok) return input.response;
    const { ip } = extractRequestContext(request);
    return apiOk(await optOutReviewReminder({ userId, source: 'result_page_review', ip }));
  } catch (error) {
    return communicationHttpError(error, 'review-reminder-delete');
  }
});
