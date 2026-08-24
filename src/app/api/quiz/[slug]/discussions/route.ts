import { getQuizService } from '@/lib/quiz-factory';
import { addDiscussionCommentRequestSchema } from '@/dtos/quiz';
import { createOptionalQuizSlugReadRoute } from '@/app/api/quiz/[slug]/optional-read-route';
import { createQuizSlugMutationRoute } from '@/app/api/quiz/[slug]/mutation-route';

// GET /api/quiz/[slug]/discussions - Get all discussions for a quiz.
// Public + authenticated dual path: read access is open; service layer
// gates personal source quizzes.
export const GET = createOptionalQuizSlugReadRoute({
  load: ({ slug, session }) => getQuizService().getQuizDiscussions(slug, session),
  logMessage: 'Error fetching discussions',
  publicErrorMessage: 'Failed to fetch discussions',
});

// POST /api/quiz/[slug]/discussions - Add a new comment to a question
export const POST = createQuizSlugMutationRoute({
  schema: addDiscussionCommentRequestSchema,
  execute: ({ slug, input, session }) =>
    getQuizService().addDiscussionComment(slug, input.questionIndex, input.content, session),
  logMessage: 'Error adding comment',
  publicErrorMessage: 'Failed to add comment',
});
