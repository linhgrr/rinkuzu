import { serviceFactory } from '@/lib/serviceFactory';
import { createOptionalQuizSlugReadRoute } from '@/app/api/quiz/[slug]/optional-read-route';

const quizService = serviceFactory.getQuizService();

export const GET = createOptionalQuizSlugReadRoute({
  load: ({ slug, userId, session }) =>
    quizService.getQuizForPlay(slug, session?.user?.role, userId ?? undefined),
  logMessage: 'Get quiz for play error',
  publicErrorMessage: 'Internal server error',
});
