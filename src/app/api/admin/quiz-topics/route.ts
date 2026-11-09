import { adminQuizTopicCreateBodySchema } from '@/dtos/admin-quiz-topic';
import { getQuizTopicAdminService } from '@/lib/admin-quiz-topic-factory';
import { withAdmin } from '@/lib/api/auth';
import { apiOk, apiServiceErr } from '@/lib/api/response';
import { parseJsonBody } from '@/lib/api/validated';

export const dynamic = 'force-dynamic';

/** Every topic hub in order, with its quiz count (RIN-1248). */
export const GET = withAdmin(async () => {
  const result = await getQuizTopicAdminService().listTopics();
  return result.success ? apiOk(result.data) : apiServiceErr(result);
});

/** Create a draft topic; returns the new list. */
export const POST = withAdmin(async (request, { userId, email }) => {
  const body = await parseJsonBody(request, adminQuizTopicCreateBodySchema);
  if (!body.ok) return body.response;

  const result = await getQuizTopicAdminService().createTopic(body.data, { id: userId, email });
  return result.success ? apiOk(result.data, 201) : apiServiceErr(result);
});
