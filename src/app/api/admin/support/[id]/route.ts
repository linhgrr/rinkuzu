import { communicationIdParamsSchema, updateSupportTicketSchema } from '@/dtos/communication';
import { withAdmin } from '@/lib/api/auth';
import { withCommunicationMutation } from '@/lib/api/communication-mutation';
import { parseRouteParams } from '@/lib/api/validated';
import { apiOk } from '@/lib/api/response';
import { communicationHttpError } from '@/lib/communication/http';
import { getSupportTicket, updateSupportTicket } from '@/lib/communication/support';

export const GET = withAdmin<{ id: string }>(async (_request, { params, userId }) => {
  const parsed = parseRouteParams(params, communicationIdParamsSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return apiOk(await getSupportTicket(parsed.data.id, userId, true));
  } catch (error) {
    return communicationHttpError(error, 'admin-support-detail');
  }
});

export const PATCH = withCommunicationMutation(
  updateSupportTicketSchema,
  'admin-support-update',
  (id, body, actor) => updateSupportTicket(id, actor, body),
);
