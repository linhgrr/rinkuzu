import type { NextRequest } from 'next/server';

import { quizDraftIdRouteParamsSchema } from '@/dtos/quiz';
import { withAuth } from '@/lib/api/auth';
import { apiErr } from '@/lib/api/response';
import { readAndValidateRouteParams } from '@/lib/api/request';
import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';

type DraftMutationMethod = 'PATCH' | 'DELETE';

interface QuizDraftIdRouteOptions {
  method?: DraftMutationMethod;
}

export function createQuizDraftIdRoute(options: QuizDraftIdRouteOptions = {}) {
  return withAuth(async (request: NextRequest, { params, userId, session }) => {
    const parsedParams = readAndValidateRouteParams(params, quizDraftIdRouteParamsSchema);
    if (!parsedParams.success) {
      return apiErr('validation_error', parsedParams.error, 400, { fields: parsedParams.fields });
    }

    const auth = { userId, userRole: session.user.role };
    const targetPath = `/quiz/drafts/${parsedParams.data.id}`;
    return options.method
      ? proxyAdaptiveRequest(request, targetPath, auth, { method: options.method })
      : proxyAdaptiveRequest(request, targetPath, auth);
  });
}
