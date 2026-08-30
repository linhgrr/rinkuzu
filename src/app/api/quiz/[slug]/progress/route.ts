import { getQuizService } from '@/lib/quiz-factory';
import { apiOk, apiServiceErr } from '@/lib/api/response';
import { savedQuizProgressSchema } from '@/dtos/quiz';
import { createQuizProgressRoute } from './progress-route';
import { parseJsonBody } from '@/lib/api/validated';

const quizService = getQuizService();

export const GET = createQuizProgressRoute({
  logMessage: 'Get quiz progress error',
  handle: async ({ slug, userId, userRole }) => {
    const result = await quizService.getSavedQuizProgress(slug, userId, userRole);
    return result.success ? apiOk(result.data) : apiServiceErr(result);
  },
});

export const PUT = createQuizProgressRoute({
  logMessage: 'Save quiz progress error',
  handle: async ({ request, slug, userId, userRole }) => {
    const parsedBody = await parseJsonBody(request, savedQuizProgressSchema);
    if (!parsedBody.ok) return parsedBody.response;

    const result = await quizService.saveQuizProgress(slug, userId, parsedBody.data, userRole);

    return result.success ? apiOk(result.data) : apiServiceErr(result);
  },
});

export const DELETE = createQuizProgressRoute({
  logMessage: 'Delete quiz progress error',
  handle: async ({ slug, userId, userRole }) => {
    const result = await quizService.deleteSavedQuizProgress(slug, userId, userRole);
    return result.success ? apiOk(result.data) : apiServiceErr(result);
  },
});
