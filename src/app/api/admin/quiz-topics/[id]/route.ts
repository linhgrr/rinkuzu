import {
  adminQuizTopicIdParamsSchema,
  adminQuizTopicUpdateBodySchema,
} from '@/dtos/admin-quiz-topic';
import { getQuizTopicAdminService } from '@/lib/admin-quiz-topic-factory';
import { withAdmin } from '@/lib/api/auth';
import { apiOk, apiServiceErr } from '@/lib/api/response';
import { parseParamsAndBody, parseRouteParams } from '@/lib/api/validated';

export const dynamic = 'force-dynamic';

/** One topic with its assigned quizzes in order. */
export const GET = withAdmin<{ id: string }>(async (_request, { params }) => {
  const parsed = parseRouteParams(params, adminQuizTopicIdParamsSchema);
  if (!parsed.ok) return parsed.response;

  const result = await getQuizTopicAdminService().getTopic(parsed.data.id);
  return result.success ? apiOk(result.data) : apiServiceErr(result);
});

/** Edit, move, publish or unpublish a topic; returns the new list. */
export const PATCH = withAdmin<{ id: string }>(async (request, { params, userId, email }) => {
  const parsed = await parseParamsAndBody(request, params, {
    params: adminQuizTopicIdParamsSchema,
    body: adminQuizTopicUpdateBodySchema,
  });
  if (!parsed.ok) return parsed.response;

  const result = await getQuizTopicAdminService().updateTopic(parsed.params.id, parsed.body, {
    id: userId,
    email,
  });
  return result.success ? apiOk(result.data) : apiServiceErr(result);
});
