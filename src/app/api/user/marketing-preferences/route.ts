import type { NextRequest } from 'next/server';
import { marketingPreferenceSchema } from '@/dtos/communication';
import { withAuth } from '@/lib/api/auth';
import { readAndValidateJson } from '@/lib/api/request';
import { apiErr, apiOk } from '@/lib/api/response';
import { extractRequestContext } from '@/lib/audit';
import {
  assertCommunicationMutationRequest,
  communicationHttpError,
} from '@/lib/communication/http';
import { getMarketingPreferences, updateMarketingPreferences } from '@/lib/communication/campaigns';

export const GET = withAuth(async (_request, { userId }) => {
  try {
    return apiOk(await getMarketingPreferences(userId));
  } catch (error) {
    return communicationHttpError(error, 'marketing-preferences-get');
  }
});

export const PUT = withAuth(async (request: NextRequest, { userId, email }) => {
  try {
    assertCommunicationMutationRequest(request);
    const input = await readAndValidateJson(request, marketingPreferenceSchema);
    if (!input.success)
      return apiErr('validation_error', input.error, 400, { fields: input.fields });
    const context = extractRequestContext(request);
    return apiOk(await updateMarketingPreferences(userId, email, input.data, context.ip));
  } catch (error) {
    return communicationHttpError(error, 'marketing-preferences-update');
  }
});
