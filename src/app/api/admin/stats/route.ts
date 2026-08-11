import { withAdmin } from '@/lib/api/auth';
import { getAdminService } from '@/lib/admin-factory';
import { apiErr, apiOk } from '@/lib/api/response';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
const TOP_CREATORS_LIMIT = 20;

export const GET = withAdmin(async () => {
  try {
    const adminService = getAdminService();

    const [statsResult, activityResult, creatorResult, scoreResult, growthResult] =
      await Promise.all([
        adminService.getStats(),
        adminService.getActivityStats(),
        adminService.getCreatorStats({ page: 1, limit: TOP_CREATORS_LIMIT }),
        adminService.getScoreStats(),
        adminService.getGrowthTrends(30),
      ]);

    if (
      !statsResult.success ||
      !activityResult.success ||
      !creatorResult.success ||
      !scoreResult.success ||
      !growthResult.success
    ) {
      return apiErr('internal_error', 'Failed to fetch statistics', 500);
    }

    const combinedStats = {
      overview: statsResult.data,
      ...activityResult.data,
      topCreators: creatorResult.data.creators,
      scoreStats: scoreResult.data,
      growthTrends: growthResult.data,
    };

    return apiOk(combinedStats);
  } catch (error) {
    logger.error({ error }, 'Error fetching admin stats');
    return apiErr('internal_error', 'Failed to fetch statistics', 500);
  }
});
