import type { NextRequest } from 'next/server';
import { createSupportAttachmentSchema } from '@/dtos/communication';
import { withAuth } from '@/lib/api/auth';
import { readAndValidateJson } from '@/lib/api/request';
import { apiErr, apiOk } from '@/lib/api/response';
import {
  assertCommunicationMutationRequest,
  communicationHttpError,
} from '@/lib/communication/http';
import { createSupportAttachmentUpload } from '@/lib/communication/service';

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  try {
    assertCommunicationMutationRequest(request);
    const input = await readAndValidateJson(request, createSupportAttachmentSchema);
    if (!input.success)
      return apiErr('validation_error', input.error, 400, { fields: input.fields });
    return apiOk(await createSupportAttachmentUpload(userId, input.data), 201);
  } catch (error) {
    return communicationHttpError(error, 'support-attachment-presign');
  }
});
