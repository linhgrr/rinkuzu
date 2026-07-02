import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAuth } from '@/lib/api/auth';
import { apiErr } from '@/lib/api/response';
import { adaptivePipelineJobsQuerySchema } from '@/dtos/adaptive-pipeline';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req, { userId, session }) => {
  const query = adaptivePipelineJobsQuerySchema.safeParse({
    limit: new URL(req.url).searchParams.get('limit') ?? undefined,
  });
  if (!query.success) {
    return apiErr('validation_error', 'Invalid pipeline jobs query parameters', 400, {
      issues: query.error.flatten().fieldErrors,
    });
  }
  return proxyAdaptiveRequest(
    req,
    `/api/pipeline/jobs?limit=${query.data.limit}`,
    { userId, userRole: session.user.role },
    { timeoutMs: 25_000 },
  );
});
