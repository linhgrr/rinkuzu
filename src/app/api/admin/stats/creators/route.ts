import { serviceFactory } from '@/lib/serviceFactory';
import { createAdminStatsListRoute } from '@/app/api/admin/stats/list-route';

export const dynamic = 'force-dynamic';

export const GET = createAdminStatsListRoute({
  load: (query) => serviceFactory.getAdminService().getCreatorStats(query),
  mapData: (data) => data,
  logMessage: 'Error fetching creator stats',
  publicErrorMessage: 'Failed to fetch creator statistics',
});
