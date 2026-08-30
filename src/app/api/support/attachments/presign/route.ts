import type { NextRequest } from 'next/server';
import { createSupportAttachmentSchema } from '@/dtos/communication';
import { withAuth } from '@/lib/api/auth';
import { apiOk } from '@/lib/api/response';
import {
  assertCommunicationMutationRequest,
  communicationHttpError,
} from '@/lib/communication/http';
import { createSupportAttachmentUpload } from '@/lib/communication/support';
import { parseJsonBody } from '@/lib/api/validated';

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  try {
    assertCommunicationMutationRequest(request);
    const input = await parseJsonBody(request, createSupportAttachmentSchema);
    if (!input.ok) return input.response;
    return apiOk(await createSupportAttachmentUpload(userId, input.data), 201);
  } catch (error) {
    return communicationHttpError(error, 'support-attachment-presign');
  }
});
