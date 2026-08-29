import type { NextRequest } from 'next/server';
import { feedbackPreferenceSchema } from '@/dtos/communication';
import { readAndValidateJson } from '@/lib/api/request';
import { apiErr, apiOk } from '@/lib/api/response';
import {
  assertCommunicationMutationRequest,
  communicationHttpError,
} from '@/lib/communication/http';
import { applyFeedbackPreference } from '@/lib/communication/feedback';

export async function POST(request: NextRequest): Promise<Response> {
  try {
    assertCommunicationMutationRequest(request);
    const input = await readAndValidateJson(request, feedbackPreferenceSchema);
    if (!input.success)
      return apiErr('validation_error', input.error, 400, { fields: input.fields });
    return apiOk(await applyFeedbackPreference(input.data.token, input.data.action));
  } catch (error) {
    return communicationHttpError(error, 'feedback-preference');
  }
}
