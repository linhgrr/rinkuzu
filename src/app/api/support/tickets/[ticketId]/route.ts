import { supportTicketParamsSchema } from '@/dtos/communication';
import { withAuth } from '@/lib/api/auth';
import { readAndValidateRouteParams } from '@/lib/api/request';
import { apiErr, apiOk } from '@/lib/api/response';
import { communicationHttpError } from '@/lib/communication/http';
import { getSupportTicket } from '@/lib/communication/support';

export const GET = withAuth<{ ticketId: string }>(async (_request, { params, userId }) => {
  const parsed = readAndValidateRouteParams(params, supportTicketParamsSchema);
  if (!parsed.success)
    return apiErr('validation_error', parsed.error, 400, { fields: parsed.fields });
  try {
    return apiOk(await getSupportTicket(parsed.data.ticketId, userId, false));
  } catch (error) {
    return communicationHttpError(error, 'support-detail');
  }
});
