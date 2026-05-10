import { NextResponse } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export const GET = withAdmin(async () => {
  try {
    const adminService = serviceFactory.getAdminService();

    // Get comprehensive stats from AdminService
    const [statsResult, activityResult, categoryResult, creatorResult] = await Promise.all([
      adminService.getStats(),
      adminService.getActivityStats(),
      adminService.getCategoryStats(),
      adminService.getCreatorStats(),
    ]);

    if (
      !statsResult.success ||
      !activityResult.success ||
      !categoryResult.success ||
      !creatorResult.success
    ) {
      return apiErr('service_error', 'Failed to fetch statistics', 500);
    }

    // Combine all stats data
    const combinedStats = {
      overview: statsResult.data,
      ...activityResult.data,
      topCategories: categoryResult.data,
      categoryStats: categoryResult.data,
      topCreators: creatorResult.data,
      // Provide defaults for missing sections to prevent frontend crashes
      scoreStats: { averageScore: 0, highestScore: 0, lowestScore: 0 },
      growthTrends: { users: [], quizzes: [], attempts: [] },
    };

    return NextResponse.json({
      success: true,
      data: combinedStats,
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return apiErr('internal_error', 'Failed to fetch statistics', 500);
  }
});
