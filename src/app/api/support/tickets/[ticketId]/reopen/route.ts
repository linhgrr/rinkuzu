import type { NextRequest } from 'next/server';
import { supportTicketParamsSchema } from '@/dtos/communication';
import { withAuth } from '@/lib/api/auth';
import { readAndValidateRouteParams } from '@/lib/api/request';
import { apiErr, apiOk } from '@/lib/api/response';
import {
  assertCommunicationMutationRequest,
  communicationHttpError,
} from '@/lib/communication/http';
import { reopenSupportTicket } from '@/lib/communication/service';

export const POST = withAuth<{ ticketId: string }>(
  async (request: NextRequest, { params, userId }) => {
    try {
      assertCommunicationMutationRequest(request);
      const parsed = readAndValidateRouteParams(params, supportTicketParamsSchema);
      if (!parsed.success)
        return apiErr('validation_error', parsed.error, 400, { fields: parsed.fields });
      return apiOk(await reopenSupportTicket(parsed.data.ticketId, userId));
    } catch (error) {
      return communicationHttpError(error, 'support-reopen');
    }
  },
);
