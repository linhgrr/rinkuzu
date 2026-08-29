import type { NextRequest } from 'next/server';
import { communicationIdParamsSchema, completeFeedbackSchema } from '@/dtos/communication';
import { withAdmin } from '@/lib/api/auth';
import { parseParamsAndBody } from '@/lib/api/validated';
import { apiOk } from '@/lib/api/response';
import {
  assertCommunicationMutationRequest,
  communicationHttpError,
} from '@/lib/communication/http';
import { completeFeedback } from '@/lib/communication/service';

export const POST = withAdmin<{ id: string }>(async (request: NextRequest, context) => {
  try {
    assertCommunicationMutationRequest(request);
    const parsed = await parseParamsAndBody(request, context.params, {
      params: communicationIdParamsSchema,
      body: completeFeedbackSchema,
    });
    if (!parsed.ok) return parsed.response;
    return apiOk(
      await completeFeedback(
        parsed.params.id,
        { id: context.userId, email: context.email },
        parsed.body.revision,
      ),
    );
  } catch (error) {
    return communicationHttpError(error, 'admin-feedback-complete');
  }
});
