import type { AdminActivityStatsListDto, AdminCreatorStatsListDto } from '@/dtos/admin-stats';
import type {
  StatsModalActivityItemViewModel,
  StatsModalCreatorItemViewModel,
  StatsModalResultViewModel,
} from '@/features/admin/stats/types/stats-modal-view-model';
import { formatDateTime } from '@/lib/formatters';

type StatsModalPayloadDto = AdminCreatorStatsListDto | AdminActivityStatsListDto;

function toCreatorItem(
  creator: AdminCreatorStatsListDto['creators'][number],
): StatsModalCreatorItemViewModel {
  return {
    id: creator.id,
    email: creator.email,
    quizCount: creator.quizCount,
    totalQuestions: creator.totalQuestions,
    joinedAt: creator.joinedAt,
    joinedAtLabel: formatDateTime(creator.joinedAt),
    role: creator.role,
  };
}

function toActivityItem(
  activity: AdminActivityStatsListDto['activities'][number],
): StatsModalActivityItemViewModel {
  return {
    ...activity,
    dateLabel: formatDateTime(activity.date),
  };
}

export function toStatsModalResultViewModel(
  type: 'creators' | 'activity',
  payload: StatsModalPayloadDto,
): StatsModalResultViewModel {
  if (type === 'creators' && 'creators' in payload) {
    return {
      items: payload.creators.map(toCreatorItem),
      pagination: payload.pagination,
    };
  }

  if (type === 'activity' && 'activities' in payload) {
    return {
      items: payload.activities.map(toActivityItem),
      pagination: payload.pagination,
    };
  }

  return {
    items: [],
    pagination: payload.pagination,
  };
}
