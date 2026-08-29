import type { NextRequest } from 'next/server';
import { communicationIdParamsSchema, updateSupportTicketSchema } from '@/dtos/communication';
import { withAdmin } from '@/lib/api/auth';
import { parseParamsAndBody, parseRouteParams } from '@/lib/api/validated';
import { apiOk } from '@/lib/api/response';
import {
  assertCommunicationMutationRequest,
  communicationHttpError,
} from '@/lib/communication/http';
import { getSupportTicket, updateSupportTicket } from '@/lib/communication/service';

export const GET = withAdmin<{ id: string }>(async (_request, { params, userId }) => {
  const parsed = parseRouteParams(params, communicationIdParamsSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return apiOk(await getSupportTicket(parsed.data.id, userId, true));
  } catch (error) {
    return communicationHttpError(error, 'admin-support-detail');
  }
});

export const PATCH = withAdmin<{ id: string }>(async (request: NextRequest, context) => {
  try {
    assertCommunicationMutationRequest(request);
    const parsed = await parseParamsAndBody(request, context.params, {
      params: communicationIdParamsSchema,
      body: updateSupportTicketSchema,
    });
    if (!parsed.ok) return parsed.response;
    return apiOk(
      await updateSupportTicket(
        parsed.params.id,
        { id: context.userId, email: context.email },
        parsed.body,
      ),
    );
  } catch (error) {
    return communicationHttpError(error, 'admin-support-update');
  }
});
