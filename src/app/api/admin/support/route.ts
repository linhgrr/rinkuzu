import type { NextRequest } from 'next/server';
import { createSupportTicketSchema, supportListQuerySchema } from '@/dtos/communication';
import { withAdmin } from '@/lib/api/auth';
import { readAndValidateJson, readAndValidateSearchParams } from '@/lib/api/request';
import { apiErr, apiOk } from '@/lib/api/response';
import {
  assertCommunicationMutationRequest,
  communicationHttpError,
} from '@/lib/communication/http';
import { createSupportTicket, listSupportTickets } from '@/lib/communication/support';

export const GET = withAdmin(async (request) => {
  const query = readAndValidateSearchParams(request, supportListQuerySchema);
  if (!query.success) return apiErr('validation_error', query.error, 400, { fields: query.fields });
  try {
    return apiOk(await listSupportTickets('', query.data, true));
  } catch (error) {
    return communicationHttpError(error, 'admin-support-list');
  }
});

export const POST = withAdmin(async (request: NextRequest, { userId, email }) => {
  try {
    assertCommunicationMutationRequest(request);
    const input = await readAndValidateJson(request, createSupportTicketSchema);
    if (!input.success)
      return apiErr('validation_error', input.error, 400, { fields: input.fields });
    if (!input.data.userId) return apiErr('validation_error', 'userId is required', 400);
    return apiOk(await createSupportTicket(userId, email, input.data, true), 201);
  } catch (error) {
    return communicationHttpError(error, 'admin-support-create');
  }
});
