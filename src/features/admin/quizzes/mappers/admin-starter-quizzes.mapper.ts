import type { AdminStarterQuizItemDto, AdminStarterQuizListDto } from '@/dtos/admin-starter-quiz';
import type {
  AdminStarterMarkBlockReason,
  AdminStarterQuizViewModel,
} from '@/features/admin/quizzes/types/admin-starter-quizzes-view-model';

function toAdminStarterQuizViewModel(item: AdminStarterQuizItemDto): AdminStarterQuizViewModel {
  return {
    id: item.id,
    quizId: item.quizId,
    title: item.title,
    questionCount: item.questionCount,
    locale: item.locale === 'en' ? 'en' : 'vi',
    order: item.order,
    quick: item.quick,
    dropReason: item.status === 'dropped' ? (item.dropReason ?? 'missing') : null,
  };
}

/** Starters in the order learners see them. */
export function toAdminStarterQuizViewModels(
  list: AdminStarterQuizListDto,
): AdminStarterQuizViewModel[] {
  return list.items
    .map(toAdminStarterQuizViewModel)
    .sort((first, second) => first.order - second.order);
}

/** The list with `starterId` moved to the 1-based `position` (clamped), renumbered 1..n. */
export function moveStarterQuiz(
  items: readonly AdminStarterQuizViewModel[],
  starterId: string,
  position: number,
): readonly AdminStarterQuizViewModel[] {
  const moving = items.find(({ id }) => id === starterId);
  if (!moving) return items;
  const rest = items.filter(({ id }) => id !== starterId);
  const index = Math.min(Math.max(position, 1), items.length) - 1;
  rest.splice(index, 0, moving);
  return rest.map((item, itemIndex) => ({ ...item, order: itemIndex + 1 }));
}

interface StarterCandidateQuiz {
  id: string;
  visibility: 'public' | 'personal';
  questionCount: number;
}

/**
 * Why a quiz row cannot be marked, judged from what the admin list knows. Premium is not in
 * the list, so the API's 422 covers it inline.
 */
export function getStarterMarkBlockReason(
  quiz: StarterCandidateQuiz,
  starterQuizIds: ReadonlySet<string>,
): AdminStarterMarkBlockReason | null {
  if (starterQuizIds.has(quiz.id)) return 'starter';
  if (quiz.visibility !== 'public') return 'not-public';
  if (quiz.questionCount < 1) return 'empty';
  return null;
}
