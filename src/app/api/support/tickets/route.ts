import type { NextRequest } from 'next/server';
import { createSupportTicketSchema, supportListQuerySchema } from '@/dtos/communication';
import { withAuth } from '@/lib/api/auth';
import { apiOk } from '@/lib/api/response';
import {
  assertCommunicationMutationRequest,
  communicationHttpError,
} from '@/lib/communication/http';
import { createSupportTicket, listSupportTickets } from '@/lib/communication/support';
import { parseJsonBody, parseSearchParams } from '@/lib/api/validated';

export const GET = withAuth(async (request, { userId }) => {
  const query = parseSearchParams(request, supportListQuerySchema);
  if (!query.ok) return query.response;
  try {
    return apiOk(await listSupportTickets(userId, query.data, false));
  } catch (error) {
    return communicationHttpError(error, 'support-list');
  }
});

export const POST = withAuth(async (request: NextRequest, { userId, email }) => {
  try {
    assertCommunicationMutationRequest(request);
    const input = await parseJsonBody(request, createSupportTicketSchema);
    if (!input.ok) return input.response;
    return apiOk(await createSupportTicket(userId, email, input.data, false), 201);
  } catch (error) {
    return communicationHttpError(error, 'support-create');
  }
});
