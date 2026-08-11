import { getQuizService } from '@/lib/quiz-factory';
import { reportQuizRequestSchema } from '@/dtos/quiz';
import { createQuizSlugMutationRoute } from '@/app/api/quiz/[slug]/mutation-route';

export const POST = createQuizSlugMutationRoute({
  schema: reportQuizRequestSchema,
  execute: ({ slug, input, email, session }) =>
    getQuizService().reportQuiz(
      slug,
      input.questionId,
      input.content,
      email,
      session.user.name || email,
      session,
    ),
  successMeta: { message: 'Report submitted successfully' },
  logMessage: 'Error submitting report',
  publicErrorMessage: 'Internal server error',
});
