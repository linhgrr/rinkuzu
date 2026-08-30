import type { NextRequest } from 'next/server';
import { supportTicketParamsSchema } from '@/dtos/communication';
import { withAuth } from '@/lib/api/auth';
import { apiOk } from '@/lib/api/response';
import {
  assertCommunicationMutationRequest,
  communicationHttpError,
} from '@/lib/communication/http';
import { reopenSupportTicket } from '@/lib/communication/support';
import { parseRouteParams } from '@/lib/api/validated';

export const POST = withAuth<{ ticketId: string }>(
  async (request: NextRequest, { params, userId }) => {
    try {
      assertCommunicationMutationRequest(request);
      const parsed = parseRouteParams(params, supportTicketParamsSchema);
      if (!parsed.ok) return parsed.response;
      return apiOk(await reopenSupportTicket(parsed.data.ticketId, userId));
    } catch (error) {
      return communicationHttpError(error, 'support-reopen');
    }
  },
);
