import { getQuizService } from '@/lib/quiz-factory';
import { createOptionalQuizSlugReadRoute } from '@/app/api/quiz/[slug]/optional-read-route';

const quizService = getQuizService();

export const GET = createOptionalQuizSlugReadRoute({
  load: ({ slug, userId, session }) =>
    quizService.getQuizForPlay(slug, session?.user?.role, userId ?? undefined),
  logMessage: 'Get quiz for play error',
  publicErrorMessage: 'Internal server error',
});
