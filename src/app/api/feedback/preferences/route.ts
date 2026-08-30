import type { NextRequest } from 'next/server';
import { feedbackPreferenceSchema } from '@/dtos/communication';
import { apiOk } from '@/lib/api/response';
import {
  assertCommunicationMutationRequest,
  communicationHttpError,
} from '@/lib/communication/http';
import { applyFeedbackPreference } from '@/lib/communication/feedback';
import { parseJsonBody } from '@/lib/api/validated';

export async function POST(request: NextRequest): Promise<Response> {
  try {
    assertCommunicationMutationRequest(request);
    const input = await parseJsonBody(request, feedbackPreferenceSchema);
    if (!input.ok) return input.response;
    return apiOk(await applyFeedbackPreference(input.data.token, input.data.action));
  } catch (error) {
    return communicationHttpError(error, 'feedback-preference');
  }
}
