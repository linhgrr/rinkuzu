import { NextRequest } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { adminStatsListQuerySchema } from '@/dtos/admin-stats';
import { buildPaginationMeta } from '@/lib/pagination';
import { readAndValidateSearchParams } from '@/lib/api/request';

export const dynamic = 'force-dynamic';

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const query = readAndValidateSearchParams(request, adminStatsListQuerySchema);
    if (!query.success) {
      return apiErr('validation_error', query.error, 400, { fields: query.fields });
    }

    const adminService = serviceFactory.getAdminService();
    const result = await adminService.getActivityStats();

    if (!result.success) {
      return apiServiceErr(result);
    }

    const activities = [
      ...result.data.recentActivity.users.map((user) => ({
        id: `user:${user.email}:${user.createdAt}`,
        type: 'user' as const,
        date: user.createdAt,
        data: user,
      })),
      ...result.data.recentActivity.quizzes.map((quiz) => ({
        id: `quiz:${quiz.title}:${quiz.createdAt}`,
        type: 'quiz' as const,
        date: quiz.createdAt,
        data: quiz,
      })),
      ...result.data.recentActivity.attempts.map((attempt) => ({
        id: `attempt:${attempt.id}`,
        type: 'attempt' as const,
        date: attempt.takenAt,
        data: attempt,
      })),
    ].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());

    const start = (query.data.page - 1) * query.data.limit;
    const pagedActivities = activities.slice(start, start + query.data.limit);

    return apiOk({
      activities: pagedActivities,
      pagination: buildPaginationMeta(query.data.page, query.data.limit, activities.length),
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching activity stats');
    return apiErr('internal_error', 'Failed to fetch activity statistics', 500);
  }
});
