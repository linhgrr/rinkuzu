import type { UserAttemptListDto, UserAttemptSummaryDto } from '@/dtos/user';
import type {
  ProfileHistoryAttemptViewModel,
  ProfileHistoryViewModel,
} from '@/features/profile/types/profile-history-view-model';
import { formatDate } from '@/lib/formatters';

export function toProfileHistoryAttemptViewModel(
  attempt: UserAttemptSummaryDto,
): ProfileHistoryAttemptViewModel {
  return {
    id: attempt.id,
    score: attempt.score,
    takenAt: attempt.takenAt,
    takenAtLabel: formatDate(attempt.takenAt),
    totalQuestions: attempt.totalQuestions,
    quiz: {
      title: attempt.quiz.title,
      slug: attempt.quiz.slug,
      description: attempt.quiz.description,
    },
  };
}

export function toProfileHistoryViewModel(dto: UserAttemptListDto): ProfileHistoryViewModel {
  return {
    attempts: dto.attempts.map(toProfileHistoryAttemptViewModel),
    pagination: dto.pagination,
  };
}
