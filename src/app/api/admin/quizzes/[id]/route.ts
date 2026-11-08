import { getAdminQuizService } from '@/lib/admin-quiz-factory';
import { createAdminQuizIdRoute, createAdminQuizVisibilityRoute } from './quiz-id-route';

const adminQuizService = getAdminQuizService();

export const GET = createAdminQuizIdRoute({
  execute: (id) => adminQuizService.getAdminQuiz(id),
});

export const DELETE = createAdminQuizIdRoute({
  execute: (id) => adminQuizService.deleteAdminQuiz(id),
  successMeta: { message: 'Quiz deleted successfully' },
});

export const PATCH = createAdminQuizVisibilityRoute({
  execute: (id, visibility, actor) =>
    adminQuizService.setAdminQuizVisibility(id, visibility, actor),
});
