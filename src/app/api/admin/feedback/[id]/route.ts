import { communicationIdParamsSchema } from '@/dtos/communication';
import { withAdmin } from '@/lib/api/auth';
import { readAndValidateRouteParams } from '@/lib/api/request';
import { apiErr, apiOk } from '@/lib/api/response';
import { communicationHttpError } from '@/lib/communication/http';
import { getFeedback } from '@/lib/communication/service';

export const GET = withAdmin<{ id: string }>(async (_request, { params }) => {
  const parsed = readAndValidateRouteParams(params, communicationIdParamsSchema);
  if (!parsed.success)
    return apiErr('validation_error', parsed.error, 400, { fields: parsed.fields });
  try {
    return apiOk(await getFeedback(parsed.data.id));
  } catch (error) {
    return communicationHttpError(error, 'admin-feedback-detail');
  }
});
