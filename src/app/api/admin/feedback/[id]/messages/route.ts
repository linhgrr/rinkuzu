import type { NextRequest } from 'next/server';
import { communicationIdParamsSchema, createFeedbackMessageSchema } from '@/dtos/communication';
import { withAdmin } from '@/lib/api/auth';
import { readAndValidateJson, readAndValidateRouteParams } from '@/lib/api/request';
import { apiErr, apiOk } from '@/lib/api/response';
import {
  assertCommunicationMutationRequest,
  communicationHttpError,
} from '@/lib/communication/http';
import { addFeedbackMessage } from '@/lib/communication/service';

export const POST = withAdmin<{ id: string }>(async (request: NextRequest, context) => {
  try {
    assertCommunicationMutationRequest(request);
    const params = readAndValidateRouteParams(context.params, communicationIdParamsSchema);
    if (!params.success)
      return apiErr('validation_error', params.error, 400, { fields: params.fields });
    const input = await readAndValidateJson(request, createFeedbackMessageSchema);
    if (!input.success)
      return apiErr('validation_error', input.error, 400, { fields: input.fields });
    return apiOk(
      await addFeedbackMessage(
        params.data.id,
        { id: context.userId, email: context.email },
        input.data,
      ),
    );
  } catch (error) {
    return communicationHttpError(error, 'admin-feedback-message');
  }
});
