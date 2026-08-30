import { communicationIdParamsSchema } from '@/dtos/communication';
import { withAdmin } from '@/lib/api/auth';
import { apiOk } from '@/lib/api/response';
import { parseRouteParams } from '@/lib/api/validated';
import { communicationHttpError } from '@/lib/communication/http';

/**
 * An operator reading one communication record by its id.
 *
 * The mutation wrapper's argument applies here too, minus the origin guard a
 * read does not need: what must not be restated per route is the error scope
 * reaching `communicationHttpError`, which is what turns a domain refusal into
 * the status it earned instead of a flattened 500.
 */
export function withCommunicationRead<TResult>(
  errorScope: string,
  load: (id: string) => Promise<TResult>,
): ReturnType<typeof withAdmin<{ id: string }>> {
  return withAdmin<{ id: string }>(async (_request, { params }): Promise<Response> => {
    const parsed = parseRouteParams(params, communicationIdParamsSchema);
    if (!parsed.ok) return parsed.response;
    try {
      return apiOk(await load(parsed.data.id));
    } catch (error) {
      return communicationHttpError(error, errorScope);
    }
  });
}
