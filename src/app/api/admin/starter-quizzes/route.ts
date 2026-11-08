import { adminStarterQuizCreateBodySchema } from '@/dtos/admin-starter-quiz';
import { getStarterQuizAdminService } from '@/lib/admin-starter-quiz-factory';
import { withAdmin } from '@/lib/api/auth';
import { apiOk, apiServiceErr } from '@/lib/api/response';
import { parseJsonBody } from '@/lib/api/validated';

export const dynamic = 'force-dynamic';

/** The starters in order, each with its live/dropped status (RIN-1177). */
export const GET = withAdmin(async () => {
  const result = await getStarterQuizAdminService().listStarterQuizzes();
  return result.success ? apiOk(result.data) : apiServiceErr(result);
});

/** Mark a public, free quiz as a starter; returns the new list. */
export const POST = withAdmin(async (request, { userId, email }) => {
  const body = await parseJsonBody(request, adminStarterQuizCreateBodySchema);
  if (!body.ok) return body.response;

  const result = await getStarterQuizAdminService().markStarterQuiz(body.data, {
    id: userId,
    email,
  });
  return result.success ? apiOk(result.data, 201) : apiServiceErr(result);
});
