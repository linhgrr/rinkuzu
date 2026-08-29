import type { NextRequest } from 'next/server';
import { communicationIdParamsSchema, createSupportMessageSchema } from '@/dtos/communication';
import { withAdmin } from '@/lib/api/auth';
import { parseParamsAndBody } from '@/lib/api/validated';
import { apiOk } from '@/lib/api/response';
import {
  assertCommunicationMutationRequest,
  communicationHttpError,
} from '@/lib/communication/http';
import { addSupportMessage } from '@/lib/communication/support';

export const POST = withAdmin<{ id: string }>(async (request: NextRequest, context) => {
  try {
    assertCommunicationMutationRequest(request);
    const parsed = await parseParamsAndBody(request, context.params, {
      params: communicationIdParamsSchema,
      body: createSupportMessageSchema,
    });
    if (!parsed.ok) return parsed.response;
    return apiOk(
      await addSupportMessage(parsed.params.id, context.userId, context.email, parsed.body, true),
    );
  } catch (error) {
    return communicationHttpError(error, 'admin-support-message');
  }
});
