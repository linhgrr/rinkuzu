import { withAuth } from '@/lib/api/auth';
import { getUserProgressStats } from '@/lib/dashboard';
import { apiErr, apiOk } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (_request, { userId }) => {
  try {
    const stats = await getUserProgressStats(userId);
    return apiOk(stats);
  } catch (error) {
    console.error('Error fetching progress stats:', error);
    return apiErr('internal_error', 'Internal Server Error', 500);
  }
});
