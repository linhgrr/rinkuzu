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

/**
 * The scaffolding every admin communication mutation needs, in one place.
 *
 * Each of these routes is a hand on someone's inbox: the same-origin JSON
 * guard, the route id and the body schema all have to hold before a campaign
 * goes out or a reply reaches a user, and the operator's identity has to ride
 * along into the write. Restating that per route is how one of them quietly
 * ends up missing a guard, so the route is left with only the part that
 * differs — which schema, which domain call, which error scope. The cost of
 * saying it once is that the guard below now stands for all of them: drop it,
 * or move it after the parse, and every route loses it in the same moment.
 */
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
