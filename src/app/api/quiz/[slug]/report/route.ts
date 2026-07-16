import { serviceFactory } from '@/lib/serviceFactory';
import { reportQuizRequestSchema } from '@/dtos/quiz';
import { createQuizSlugMutationRoute } from '@/app/api/quiz/[slug]/mutation-route';

export const POST = createQuizSlugMutationRoute({
  schema: reportQuizRequestSchema,
  missingEmailError: { code: 'validation_error', detail: 'User email is required', status: 400 },
  execute: ({ slug, input, email, session }) =>
    serviceFactory
      .getQuizService()
      .reportQuiz(slug, input.content, email, session.user.name || email),
  successMeta: { message: 'Report submitted successfully' },
  logMessage: 'Error submitting report',
  publicErrorMessage: 'Internal server error',
});
