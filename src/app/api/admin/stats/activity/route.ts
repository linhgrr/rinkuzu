import { serviceFactory } from '@/lib/serviceFactory';
import { buildPaginationMeta } from '@/lib/pagination';
import { createAdminStatsListRoute } from '@/app/api/admin/stats/list-route';

export const dynamic = 'force-dynamic';

export const GET = createAdminStatsListRoute({
  load: () => serviceFactory.getAdminService().getActivityStats(),
  mapData: (data, query) => {
    const activities = [
      ...data.recentActivity.users.map((user) => ({
        id: `user:${user.email}:${user.createdAt}`,
        type: 'user' as const,
        date: user.createdAt,
        data: user,
      })),
      ...data.recentActivity.quizzes.map((quiz) => ({
        id: `quiz:${quiz.title}:${quiz.createdAt}`,
        type: 'quiz' as const,
        date: quiz.createdAt,
        data: quiz,
      })),
      ...data.recentActivity.attempts.map((attempt) => ({
        id: `attempt:${attempt.id}`,
        type: 'attempt' as const,
        date: attempt.takenAt,
        data: attempt,
      })),
    ].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());

    const start = (query.page - 1) * query.limit;

    return {
      activities: activities.slice(start, start + query.limit),
      pagination: buildPaginationMeta(query.page, query.limit, activities.length),
    };
  },
  logMessage: 'Error fetching activity stats',
  publicErrorMessage: 'Failed to fetch activity statistics',
});
