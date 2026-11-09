import { getQuizPersonalDataFlagService } from '@/lib/admin-quiz-factory';
import { createAdminQuizActorRoute } from '../quiz-id-route';

const personalDataFlagService = getQuizPersonalDataFlagService();

/** Admin Clear flag: marks the personal-data flag cleared and audits it (RIN-1342). */
export const POST = createAdminQuizActorRoute({
  execute: (id, actor) => personalDataFlagService.clear(id, actor),
});
