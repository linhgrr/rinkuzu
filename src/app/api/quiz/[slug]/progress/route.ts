import { getQuizService } from '@/lib/quiz-factory';
import { apiOk, apiErr, apiServiceErr } from '@/lib/api/response';
import { readAndValidateJson } from '@/lib/api/request';
import { savedQuizProgressSchema } from '@/dtos/quiz';
import { createQuizProgressRoute } from './progress-route';

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
    const parsedBody = await readAndValidateJson(request, savedQuizProgressSchema);
    if (!parsedBody.success) {
      return apiErr('validation_error', parsedBody.error, 400, parsedBody.fields);
    }

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
