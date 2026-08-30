import { supportTicketParamsSchema } from '@/dtos/communication';
import { withAuth } from '@/lib/api/auth';
import { apiOk } from '@/lib/api/response';
import { communicationHttpError } from '@/lib/communication/http';
import { getSupportTicket } from '@/lib/communication/support';
import { parseRouteParams } from '@/lib/api/validated';

export const GET = withAuth<{ ticketId: string }>(async (_request, { params, userId }) => {
  const parsed = parseRouteParams(params, supportTicketParamsSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return apiOk(await getSupportTicket(parsed.data.ticketId, userId, false));
  } catch (error) {
    return communicationHttpError(error, 'support-detail');
  }
});
