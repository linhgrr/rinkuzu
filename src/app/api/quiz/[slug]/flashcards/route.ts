import { serviceFactory } from '@/lib/serviceFactory';
import { createOptionalQuizSlugReadRoute } from '@/app/api/quiz/[slug]/optional-read-route';

export const GET = createOptionalQuizSlugReadRoute({
  load: ({ slug, session }) => serviceFactory.getQuizService().getQuizForFlashcards(slug, session),
  logMessage: 'Get flashcard quiz error',
  publicErrorMessage: 'Internal server error',
});
