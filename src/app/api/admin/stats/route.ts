import { withAdmin } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk } from '@/lib/api/response';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const GET = withAdmin(async () => {
  try {
    const adminService = serviceFactory.getAdminService();

    const [statsResult, activityResult, creatorResult] = await Promise.all([
      adminService.getStats(),
      adminService.getActivityStats(),
      adminService.getCreatorStats(),
    ]);

    if (!statsResult.success || !activityResult.success || !creatorResult.success) {
      return apiErr('internal_error', 'Failed to fetch statistics', 500);
    }

    const combinedStats = {
      overview: statsResult.data,
      ...activityResult.data,
      topCreators: creatorResult.data,
      scoreStats: { averageScore: 0, highestScore: 0, lowestScore: 0 },
      growthTrends: { users: [], quizzes: [], attempts: [] },
    };

    return apiOk(combinedStats);
  } catch (error) {
    logger.error({ error }, 'Error fetching admin stats');
    return apiErr('internal_error', 'Failed to fetch statistics', 500);
  }
});
