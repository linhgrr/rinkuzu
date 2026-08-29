import type { NextRequest } from 'next/server';
import type { ZodType } from 'zod';
import { communicationIdParamsSchema } from '@/dtos/communication';
import { withAdmin } from '@/lib/api/auth';
import { parseParamsAndBody } from '@/lib/api/validated';
import { apiOk } from '@/lib/api/response';
import type { AdminActor } from '@/lib/communication/internal';
import {
  assertCommunicationMutationRequest,
  communicationHttpError,
} from '@/lib/communication/http';

export function withCommunicationMutation<TBody, TResult>(
  bodySchema: ZodType<TBody>,
  errorScope: string,
  run: (id: string, body: TBody, actor: AdminActor) => Promise<TResult>,
): ReturnType<typeof withAdmin<{ id: string }>> {
  return withAdmin<{ id: string }>(async (request: NextRequest, context): Promise<Response> => {
    try {
      assertCommunicationMutationRequest(request);
      const parsed = await parseParamsAndBody(request, context.params, {
        params: communicationIdParamsSchema,
        body: bodySchema,
      });
      if (!parsed.ok) return parsed.response;
      return apiOk(
        await run(parsed.params.id, parsed.body, {
          id: context.userId,
          email: context.email,
        }),
      );
    } catch (error) {
      return communicationHttpError(error, errorScope);
    }
  });
}
