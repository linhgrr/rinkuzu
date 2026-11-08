import {
  adminStarterQuizIdParamsSchema,
  adminStarterQuizUpdateBodySchema,
} from '@/dtos/admin-starter-quiz';
import { getStarterQuizAdminService } from '@/lib/admin-starter-quiz-factory';
import { withAdmin } from '@/lib/api/auth';
import { apiOk, apiServiceErr } from '@/lib/api/response';
import { parseParamsAndBody, parseRouteParams } from '@/lib/api/validated';

export const dynamic = 'force-dynamic';

/** Change a starter's locale, or move it to a 1-based position; returns the new list. */
export const PATCH = withAdmin<{ id: string }>(async (request, { params, userId, email }) => {
  const parsed = await parseParamsAndBody(request, params, {
    params: adminStarterQuizIdParamsSchema,
    body: adminStarterQuizUpdateBodySchema,
  });
  if (!parsed.ok) return parsed.response;

  const result = await getStarterQuizAdminService().updateStarterQuiz(
    parsed.params.id,
    parsed.body,
    { id: userId, email },
  );
  return result.success ? apiOk(result.data) : apiServiceErr(result);
});

/** Unmark a starter; the rest close the gap. Returns the new list. */
export const DELETE = withAdmin<{ id: string }>(async (_request, { params, userId, email }) => {
  const parsed = parseRouteParams(params, adminStarterQuizIdParamsSchema);
  if (!parsed.ok) return parsed.response;

  const result = await getStarterQuizAdminService().unmarkStarterQuiz(parsed.data.id, {
    id: userId,
    email,
  });
  return result.success ? apiOk(result.data) : apiServiceErr(result);
});
