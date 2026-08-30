import type { NextRequest } from 'next/server';
import { createFeedbackConversationSchema, feedbackListQuerySchema } from '@/dtos/communication';
import { withAdmin } from '@/lib/api/auth';
import { apiOk } from '@/lib/api/response';
import {
  assertCommunicationMutationRequest,
  communicationHttpError,
} from '@/lib/communication/http';
import { createFeedback, listFeedback } from '@/lib/communication/feedback';
import { parseJsonBody, parseSearchParams } from '@/lib/api/validated';

export const GET = withAdmin(async (request) => {
  const query = parseSearchParams(request, feedbackListQuerySchema);
  if (!query.ok) return query.response;
  try {
    return apiOk(await listFeedback(query.data));
  } catch (error) {
    return communicationHttpError(error, 'admin-feedback-list');
  }
});

export const POST = withAdmin(async (request: NextRequest, { userId, email }) => {
  try {
    assertCommunicationMutationRequest(request);
    const input = await parseJsonBody(request, createFeedbackConversationSchema);
    if (!input.ok) return input.response;
    return apiOk(await createFeedback({ id: userId, email }, input.data), 201);
  } catch (error) {
    return communicationHttpError(error, 'admin-feedback-create');
  }
});
