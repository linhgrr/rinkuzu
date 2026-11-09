import {
  adminQuizTopicQuizParamsSchema,
  adminQuizTopicReorderBodySchema,
} from '@/dtos/admin-quiz-topic';
import { getQuizTopicAdminService } from '@/lib/admin-quiz-topic-factory';
import { withAdmin } from '@/lib/api/auth';
import { apiOk, apiServiceErr } from '@/lib/api/response';
import { parseParamsAndBody, parseRouteParams } from '@/lib/api/validated';

export const dynamic = 'force-dynamic';

type TopicQuizParams = { id: string; quizId: string };

/** Move the quiz to a 1-based position in the topic; the others shift. */
export const PATCH = withAdmin<TopicQuizParams>(async (request, { params, userId, email }) => {
  const parsed = await parseParamsAndBody(request, params, {
    params: adminQuizTopicQuizParamsSchema,
    body: adminQuizTopicReorderBodySchema,
  });
  if (!parsed.ok) return parsed.response;

  const result = await getQuizTopicAdminService().reorderQuiz(
    parsed.params.id,
    parsed.params.quizId,
    parsed.body,
    { id: userId, email },
  );
  return result.success ? apiOk(result.data) : apiServiceErr(result);
});

/** Remove the quiz from the topic; the rest close the gap. */
export const DELETE = withAdmin<TopicQuizParams>(async (_request, { params, userId, email }) => {
  const parsed = parseRouteParams(params, adminQuizTopicQuizParamsSchema);
  if (!parsed.ok) return parsed.response;

  const result = await getQuizTopicAdminService().unassignQuiz(parsed.data.id, parsed.data.quizId, {
    id: userId,
    email,
  });
  return result.success ? apiOk(result.data) : apiServiceErr(result);
});
