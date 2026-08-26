import type { NextRequest } from 'next/server';
import { createSupportTicketSchema, supportListQuerySchema } from '@/dtos/communication';
import { withAuth } from '@/lib/api/auth';
import { readAndValidateJson, readAndValidateSearchParams } from '@/lib/api/request';
import { apiErr, apiOk } from '@/lib/api/response';
import {
  assertCommunicationMutationRequest,
  communicationHttpError,
} from '@/lib/communication/http';
import { createSupportTicket, listSupportTickets } from '@/lib/communication/service';

export const GET = withAuth(async (request, { userId }) => {
  const query = readAndValidateSearchParams(request, supportListQuerySchema);
  if (!query.success) return apiErr('validation_error', query.error, 400, { fields: query.fields });
  try {
    return apiOk(await listSupportTickets(userId, query.data, false));
  } catch (error) {
    return communicationHttpError(error, 'support-list');
  }
});

export const POST = withAuth(async (request: NextRequest, { userId, email }) => {
  try {
    assertCommunicationMutationRequest(request);
    const input = await readAndValidateJson(request, createSupportTicketSchema);
    if (!input.success)
      return apiErr('validation_error', input.error, 400, { fields: input.fields });
    return apiOk(await createSupportTicket(userId, email, input.data, false), 201);
  } catch (error) {
    return communicationHttpError(error, 'support-create');
  }
});
