import {
  adminQuizTopicAssignBodySchema,
  adminQuizTopicIdParamsSchema,
} from '@/dtos/admin-quiz-topic';
import { getQuizTopicAdminService } from '@/lib/admin-quiz-topic-factory';
import { withAdmin } from '@/lib/api/auth';
import { apiOk, apiServiceErr } from '@/lib/api/response';
import { parseParamsAndBody } from '@/lib/api/validated';

export const dynamic = 'force-dynamic';

/** Add a public quiz to the topic; returns the topic with its quizzes. */
export const POST = withAdmin<{ id: string }>(async (request, { params, userId, email }) => {
  const parsed = await parseParamsAndBody(request, params, {
    params: adminQuizTopicIdParamsSchema,
    body: adminQuizTopicAssignBodySchema,
  });
  if (!parsed.ok) return parsed.response;

  const result = await getQuizTopicAdminService().assignQuiz(parsed.params.id, parsed.body, {
    id: userId,
    email,
  });
  return result.success ? apiOk(result.data, 201) : apiServiceErr(result);
});
