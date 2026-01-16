import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Admin access required' },
        { status: 401 }
      );
    }

    const adminService = serviceFactory.getAdminService();

    // Get comprehensive stats from AdminService
    const [statsResult, activityResult, categoryResult, creatorResult] = await Promise.all([
      adminService.getStats(),
      adminService.getActivityStats(),
      adminService.getCategoryStats(),
      adminService.getCreatorStats()
    ]);

    if (!statsResult.success || !activityResult.success || !categoryResult.success || !creatorResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch statistics'
        },
        { status: 500 }
      );
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
      growthTrends: { users: [], quizzes: [], attempts: [] }
    };

    return NextResponse.json({
      success: true,
      data: combinedStats
    });

  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
} 