import type {
  AdminQuizTopicDetailDto,
  AdminQuizTopicItemDto,
  AdminQuizTopicListDto,
} from '@/dtos/admin-quiz-topic';
import type {
  AdminQuizTopicDetailViewModel,
  AdminQuizTopicQuizViewModel,
  AdminQuizTopicViewModel,
} from '@/features/admin/quizzes/types/admin-quiz-topics-view-model';

function toAdminQuizTopicViewModel(item: AdminQuizTopicItemDto): AdminQuizTopicViewModel {
  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    intro: item.intro,
    introWords: item.introWords,
    order: item.order,
    published: item.published,
    quizCount: item.quizCount,
  };
}

/** Topics in admin order. */
export function toAdminQuizTopicViewModels(list: AdminQuizTopicListDto): AdminQuizTopicViewModel[] {
  return list.items
    .map(toAdminQuizTopicViewModel)
    .sort((first, second) => first.order - second.order);
}

/** One topic with its quizzes in order. */
export function toAdminQuizTopicDetailViewModel(
  detail: AdminQuizTopicDetailDto,
): AdminQuizTopicDetailViewModel {
  return {
    topic: toAdminQuizTopicViewModel(detail.topic),
    quizzes: detail.quizzes
      .map(
        (quiz): AdminQuizTopicQuizViewModel => ({
          quizId: quiz.quizId,
          order: quiz.order,
          title: quiz.title,
          questionCount: quiz.questionCount,
          isPublic: quiz.isPublic,
        }),
      )
      .sort((first, second) => first.order - second.order),
  };
}

/** The quizzes with `quizId` moved to the 1-based `position` (clamped), renumbered 1..n. */
export function moveTopicQuiz(
  quizzes: readonly AdminQuizTopicQuizViewModel[],
  quizId: string,
  position: number,
): AdminQuizTopicQuizViewModel[] {
  const moving = quizzes.find((quiz) => quiz.quizId === quizId);
  if (!moving) return [...quizzes];
  const rest = quizzes.filter((quiz) => quiz.quizId !== quizId);
  const index = Math.min(Math.max(position, 1), quizzes.length) - 1;
  rest.splice(index, 0, moving);
  return rest.map((quiz, quizIndex) => ({ ...quiz, order: quizIndex + 1 }));
}
