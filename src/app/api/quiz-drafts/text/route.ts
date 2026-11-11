import { createTextQuizDraftRequestSchema } from '@/dtos/quiz-draft';
import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAuth } from '@/lib/api/auth';
import { apiErr } from '@/lib/api/response';
import { quizDraftJobLinkFromEnvelope } from '@/lib/quiz/draft-usage';
import { quizTextLengthRefusal, readQuizTextBody } from '@/lib/quiz/text-source-request';

export const dynamic = 'force-dynamic';

/**
 * Signed-in quiz draft from pasted text (RIN-1538). Validated here so a bad request never
 * reaches the API, then metered like a PDF draft: one `quiz_extract` unit, linked to the
 * draft so a failed extraction refunds it. The draft lands in the normal draft review.
 * The text goes to the API only and is never logged.
 */
export const POST = withAuth(async (request, { userId, session }) => {
  const read = await readQuizTextBody(request, '');
  if (!read.ok) return read.response;

  const parsed = createTextQuizDraftRequestSchema.safeParse(read.body);
  if (!parsed.success) {
    return (
      quizTextLengthRefusal(parsed.error, '') ??
      apiErr('validation_error', 'Invalid text draft request', 400)
    );
  }

  return proxyAdaptiveRequest(
    request,
    '/quiz/drafts/text',
    { userId, userRole: session.user.role },
    {
      method: 'POST',
      body: JSON.stringify(parsed.data),
      contentType: 'application/json',
      llmAction: 'quiz_extract',
      llmJobLink: quizDraftJobLinkFromEnvelope,
    },
  );
});
