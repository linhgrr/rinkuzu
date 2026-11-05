import { getQuizService } from '@/lib/quiz-factory';
import { createOptionalQuizSlugReadRoute } from '@/app/api/quiz/[slug]/optional-read-route';
import { quizPlayQuerySchema } from '@/dtos/quiz';

const quizService = getQuizService();

function readRetryOf(request: Request): string | null | undefined {
  const parsed = quizPlayQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  return parsed.success ? parsed.data.retryOf : null;
}

export const GET = createOptionalQuizSlugReadRoute({
  load: async ({ slug, userId, session, request }) => {
    const retryOf = readRetryOf(request);
    if (retryOf === null) {
      return {
        success: false,
        error: 'Invalid retryOf',
        statusCode: 400,
        code: 'validation_error',
      };
    }
    return retryOf === undefined
      ? quizService.getQuizForPlay(slug, session?.user?.role, userId ?? undefined)
      : quizService.getRetryQuizForPlay(slug, retryOf, userId ?? undefined, session?.user?.role);
  },
  logMessage: 'Get quiz for play error',
  publicErrorMessage: 'Internal server error',
});
