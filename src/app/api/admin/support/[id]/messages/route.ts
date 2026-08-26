import type { NextRequest } from 'next/server';
import { communicationIdParamsSchema, createSupportMessageSchema } from '@/dtos/communication';
import { withAdmin } from '@/lib/api/auth';
import { readAndValidateJson, readAndValidateRouteParams } from '@/lib/api/request';
import { apiErr, apiOk } from '@/lib/api/response';
import {
  assertCommunicationMutationRequest,
  communicationHttpError,
} from '@/lib/communication/http';
import { addSupportMessage } from '@/lib/communication/service';

export const POST = withAdmin<{ id: string }>(async (request: NextRequest, context) => {
  try {
    assertCommunicationMutationRequest(request);
    const params = readAndValidateRouteParams(context.params, communicationIdParamsSchema);
    if (!params.success)
      return apiErr('validation_error', params.error, 400, { fields: params.fields });
    const input = await readAndValidateJson(request, createSupportMessageSchema);
    if (!input.success)
      return apiErr('validation_error', input.error, 400, { fields: input.fields });
    return apiOk(
      await addSupportMessage(params.data.id, context.userId, context.email, input.data, true),
    );
  } catch (error) {
    return communicationHttpError(error, 'admin-support-message');
  }
});
