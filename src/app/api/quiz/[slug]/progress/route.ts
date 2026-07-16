import { serviceFactory } from '@/lib/serviceFactory';
import { apiOk, apiErr, apiServiceErr } from '@/lib/api/response';
import { readAndValidateJson } from '@/lib/api/request';
import { savedQuizProgressSchema } from '@/dtos/quiz';
import { createQuizProgressRoute } from './progress-route';

const quizService = serviceFactory.getQuizService();

export const GET = createQuizProgressRoute({
  logMessage: 'Get quiz progress error',
  handle: async ({ slug, userId }) => {
    const result = await quizService.getSavedQuizProgress(slug, userId);
    return result.success ? apiOk(result.data) : apiServiceErr(result);
  },
});

export const PUT = createQuizProgressRoute({
  logMessage: 'Save quiz progress error',
  handle: async ({ request, slug, userId }) => {
    const parsedBody = await readAndValidateJson(request, savedQuizProgressSchema);
    if (!parsedBody.success) {
      return apiErr('validation_error', parsedBody.error, 400, parsedBody.fields);
    }

    const result = await quizService.saveQuizProgress(slug, userId, parsedBody.data);

    return result.success ? apiOk(result.data) : apiServiceErr(result);
  },
});

export const DELETE = createQuizProgressRoute({
  logMessage: 'Delete quiz progress error',
  handle: async ({ slug, userId }) => {
    const result = await quizService.deleteSavedQuizProgress(slug, userId);
    return result.success ? apiOk(result.data) : apiServiceErr(result);
  },
});
