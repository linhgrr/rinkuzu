import type { NextRequest } from 'next/server';
import { createSupportTicketSchema, supportListQuerySchema } from '@/dtos/communication';
import { withAdmin } from '@/lib/api/auth';
import { apiErr, apiOk } from '@/lib/api/response';
import {
  assertCommunicationMutationRequest,
  communicationHttpError,
} from '@/lib/communication/http';
import { createSupportTicket, listSupportTickets } from '@/lib/communication/support';
import { parseJsonBody, parseSearchParams } from '@/lib/api/validated';

export const GET = withAdmin(async (request) => {
  const query = parseSearchParams(request, supportListQuerySchema);
  if (!query.ok) return query.response;
  try {
    return apiOk(await listSupportTickets('', query.data, true));
  } catch (error) {
    return communicationHttpError(error, 'admin-support-list');
  }
});

export const POST = withAdmin(async (request: NextRequest, { userId, email }) => {
  try {
    assertCommunicationMutationRequest(request);
    const input = await parseJsonBody(request, createSupportTicketSchema);
    if (!input.ok) return input.response;
    if (!input.data.userId) return apiErr('validation_error', 'userId is required', 400);
    return apiOk(await createSupportTicket(userId, email, input.data, true), 201);
  } catch (error) {
    return communicationHttpError(error, 'admin-support-create');
  }
});
