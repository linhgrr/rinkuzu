import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAdmin } from '@/lib/api/auth';
import { parseSearchParams } from '@/lib/api/validated';
import { personalLearningSummaryQuerySchema } from '@/dtos/admin-personal-learning';

export const dynamic = 'force-dynamic';

export const GET = withAdmin(async (req, { userId, session }) => {
  const query = parseSearchParams(req, personalLearningSummaryQuerySchema);
  if (!query.ok) return query.response;

  const upstreamUrl = new URL(req.url);
  upstreamUrl.search = '';
  upstreamUrl.searchParams.set('window', query.data.window);
  const response = await proxyAdaptiveRequest(
    new Request(upstreamUrl, { method: 'GET', headers: req.headers, signal: req.signal }),
    '/admin/personal-learning/summary',
    { userId, userRole: session.user.role },
  );
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Pragma', 'no-cache');
  return response;
});
