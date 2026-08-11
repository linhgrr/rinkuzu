import { getQuizService } from '@/lib/quiz-factory';
import { createOptionalQuizSlugReadRoute } from '@/app/api/quiz/[slug]/optional-read-route';

export const GET = createOptionalQuizSlugReadRoute({
  load: ({ slug, session }) => getQuizService().getQuizForFlashcards(slug, session),
  logMessage: 'Get flashcard quiz error',
  publicErrorMessage: 'Internal server error',
});
