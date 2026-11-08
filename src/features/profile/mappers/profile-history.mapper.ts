import type { UserAttemptListDto, UserAttemptSummaryDto } from '@/dtos/user';
import type {
  ProfileHistoryAttemptViewModel,
  ProfileHistoryViewModel,
} from '@/features/profile/types/profile-history-view-model';
import { formatCalendarDate } from '@/lib/formatters';

function toProfileHistoryAttemptViewModel(
  attempt: UserAttemptSummaryDto,
  locale: string,
): ProfileHistoryAttemptViewModel {
  return {
    id: attempt.id,
    score: attempt.score,
    takenAt: attempt.takenAt,
    takenAtLabel: formatCalendarDate(attempt.takenAt, locale),
    totalQuestions: attempt.totalQuestions,
    ...(attempt.mode !== undefined && { mode: attempt.mode }),
    quiz: {
      title: attempt.quiz.title,
      slug: attempt.quiz.slug,
      ...(attempt.quiz.description !== undefined && { description: attempt.quiz.description }),
    },
  };
}

export function toProfileHistoryViewModel(
  dto: UserAttemptListDto,
  locale: string,
): ProfileHistoryViewModel {
  return {
    attempts: dto.attempts.map((attempt) => toProfileHistoryAttemptViewModel(attempt, locale)),
    pagination: dto.pagination,
    summary: {
      totalAttempts: dto.summary.totalAttempts,
      averageScore: dto.summary.averageScore === null ? null : Math.round(dto.summary.averageScore),
      needsWorkCount: dto.summary.needsWorkCount,
    },
  };
}
