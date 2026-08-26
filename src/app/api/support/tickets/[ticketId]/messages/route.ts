import type { NextRequest } from 'next/server';
import { createSupportMessageSchema, supportTicketParamsSchema } from '@/dtos/communication';
import { withAuth } from '@/lib/api/auth';
import { readAndValidateJson, readAndValidateRouteParams } from '@/lib/api/request';
import { apiErr, apiOk } from '@/lib/api/response';
import {
  assertCommunicationMutationRequest,
  communicationHttpError,
} from '@/lib/communication/http';
import { addSupportMessage } from '@/lib/communication/service';

export const POST = withAuth<{ ticketId: string }>(async (request: NextRequest, context) => {
  try {
    assertCommunicationMutationRequest(request);
    const params = readAndValidateRouteParams(context.params, supportTicketParamsSchema);
    if (!params.success)
      return apiErr('validation_error', params.error, 400, { fields: params.fields });
    const input = await readAndValidateJson(request, createSupportMessageSchema);
    if (!input.success)
      return apiErr('validation_error', input.error, 400, { fields: input.fields });
    return apiOk(
      await addSupportMessage(
        params.data.ticketId,
        context.userId,
        context.email,
        input.data,
        false,
      ),
    );
  } catch (error) {
    return communicationHttpError(error, 'support-message');
  }
});
