import type { NextRequest } from 'next/server';

import { quizDraftIdRouteParamsSchema } from '@/dtos/quiz';
import { withAuth } from '@/lib/api/auth';
import { parseRouteParams } from '@/lib/api/validated';
import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import {
  settleQuizDraftUsageBeforeDelete,
  settleQuizDraftUsageFromResponse,
} from '@/lib/quiz/draft-usage';

type DraftMutationMethod = 'PATCH' | 'DELETE';

interface QuizDraftIdRouteOptions {
  method?: DraftMutationMethod;
}

export function createQuizDraftIdRoute(options: QuizDraftIdRouteOptions = {}) {
  return withAuth(async (request: NextRequest, { params, userId, session }) => {
    const parsedParams = parseRouteParams(params, quizDraftIdRouteParamsSchema);
    if (!parsedParams.ok) return parsedParams.response;

    const auth = { userId, userRole: session.user.role };
    const targetPath = `/quiz/drafts/${parsedParams.data.id}`;
    // Deleting removes the draft, so settle its quiz_extract unit first: a
    // failed draft deleted unread still gets its refund (RIN-596).
    if (options.method === 'DELETE') {
      await settleQuizDraftUsageBeforeDelete(parsedParams.data.id, auth);
    }
    const response = options.method
      ? await proxyAdaptiveRequest(request, targetPath, auth, { method: options.method })
      : await proxyAdaptiveRequest(request, targetPath, auth);
    if (!options.method) await settleQuizDraftUsageFromResponse(response, auth);
    return response;
  });
}
