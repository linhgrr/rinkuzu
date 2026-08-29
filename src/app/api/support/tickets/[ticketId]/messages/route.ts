import type { NextRequest } from 'next/server';
import { createSupportMessageSchema, supportTicketParamsSchema } from '@/dtos/communication';
import { withAuth } from '@/lib/api/auth';
import { parseParamsAndBody } from '@/lib/api/validated';
import { apiOk } from '@/lib/api/response';
import {
  assertCommunicationMutationRequest,
  communicationHttpError,
} from '@/lib/communication/http';
import { addSupportMessage } from '@/lib/communication/service';

export const POST = withAuth<{ ticketId: string }>(async (request: NextRequest, context) => {
  try {
    assertCommunicationMutationRequest(request);
    const parsed = await parseParamsAndBody(request, context.params, {
      params: supportTicketParamsSchema,
      body: createSupportMessageSchema,
    });
    if (!parsed.ok) return parsed.response;
    return apiOk(
      await addSupportMessage(
        parsed.params.ticketId,
        context.userId,
        context.email,
        parsed.body,
        false,
      ),
    );
  } catch (error) {
    return communicationHttpError(error, 'support-message');
  }
});
