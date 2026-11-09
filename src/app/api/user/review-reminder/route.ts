import type { NextRequest } from 'next/server';
import { reviewReminderRequestSchema, reviewReminderStatusQuerySchema } from '@/dtos/communication';
import { withAuth } from '@/lib/api/auth';
import { apiOk } from '@/lib/api/response';
import { parseJsonBody, parseSearchParams } from '@/lib/api/validated';
import { extractRequestContext } from '@/lib/audit';
import {
  assertCommunicationMutationRequest,
  communicationHttpError,
} from '@/lib/communication/http';
import {
  optInReviewReminder,
  optOutReviewReminder,
  reviewReminderStatus,
  snoozeReviewReminderPrompt,
} from '@/lib/communication/review-reminder';

/**
 * Result-page opt-in to the 2-day review email (RIN-911 AC3/AC4, RIN-1362).
 * `POST { attemptId, optIn?, locale? }`: `optIn: false` un-ticks it;
 * `POST { attemptId, action: 'snooze' }` is "No thanks" (prompt hidden 7 days).
 * `DELETE { attemptId }` un-ticks it too.
 * `GET ?attemptId=` reports `{ optedIn, snoozedUntil, eligible }` for the prompt.
 */
export const GET = withAuth(async (request: NextRequest, { userId, email }) => {
  try {
    const query = parseSearchParams(request, reviewReminderStatusQuerySchema);
    if (!query.ok) return query.response;
    return apiOk(await reviewReminderStatus({ userId, email, attemptId: query.data.attemptId }));
  } catch (error) {
    return communicationHttpError(error, 'review-reminder-status');
  }
});

export const POST = withAuth(async (request: NextRequest, { userId, email }) => {
  try {
    assertCommunicationMutationRequest(request);
    const input = await parseJsonBody(request, reviewReminderRequestSchema);
    if (!input.ok) return input.response;
    if (input.data.action === 'snooze') {
      return apiOk(await snoozeReviewReminderPrompt({ userId }));
    }
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
