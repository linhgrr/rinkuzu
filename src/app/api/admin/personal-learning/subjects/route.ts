import { z } from 'zod';
import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { getAdminAuditRepository } from '@/lib/admin-audit-factory';
import { withAdmin } from '@/lib/api/auth';
import { apiErr, apiOk } from '@/lib/api/response';
import { parseSearchParams } from '@/lib/api/validated';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const PIPELINE_STATUSES = [
  'pending',
  'queued',
  'loading',
  'chunking',
  'extracting',
  'embedding',
  'merging',
  'ranking',
  'verifying',
  'building_graph',
  'optimizing',
  'completed',
  'failed',
  'cancelled',
] as const;

// Mirrors the bounds of the adaptive API's GET /api/admin/personal-learning/subjects.
const querySchema = z
  .object({
    user_id: z.string().trim().min(1).max(128),
    window: z.enum(['7d', '30d', '90d', 'all']).default('all'),
    pipeline_status: z.enum(PIPELINE_STATUSES).optional(),
    progress_status: z.enum(['active', 'completed']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().min(1).max(512).optional(),
  })
  .strict();

// Only these fields may reach the browser, even if upstream starts returning more.
const subjectSchema = z
  .object({
    job_id: z.string(),
    filename: z.string(),
    pipeline_status: z.string(),
    progress_status: z.string().nullable().default(null),
    accuracy: z.number().default(0),
    progress_percent: z.number().default(0),
    last_activity_at: z.string().nullable().default(null),
  })
  .strip();

const upstreamSchema = z.object({
  success: z.literal(true),
  data: z.object({
    subjects: z.array(subjectSchema),
    next_cursor: z.string().nullable().default(null),
  }),
});

const NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store', Pragma: 'no-cache' } as const;

/**
 * One learner's subjects, for admin support.
 *
 * Every view that returns learner data writes exactly one audit entry first.
 * The write is awaited and fail-closed: if it throws, the data is withheld.
 */
export const GET = withAdmin(async (req, { userId, email, session }) => {
  const query = parseSearchParams(req, querySchema);
  if (!query.ok) return query.response;

  const upstreamUrl = new URL(req.url);
  upstreamUrl.search = '';
  for (const [key, value] of Object.entries(query.data)) {
    if (value !== undefined) upstreamUrl.searchParams.set(key, String(value));
  }
  const upstream = await proxyAdaptiveRequest(
    new Request(upstreamUrl, { method: 'GET', headers: req.headers, signal: req.signal }),
    '/admin/personal-learning/subjects',
    { userId, userRole: session.user.role },
  );

  // Upstream errors carry no learner data and record no view.
  if (!upstream.ok) {
    upstream.headers.set('Cache-Control', 'private, no-store');
    upstream.headers.set('Pragma', 'no-cache');
    return upstream;
  }

  const parsed = upstreamSchema.safeParse(await upstream.json().catch(() => null));
  if (!parsed.success) {
    logger.error(
      { status: upstream.status },
      'Learner subjects upstream returned an unexpected body',
    );
    return apiErr('upstream_error', 'Learner subjects are unavailable', 502);
  }

  try {
    await getAdminAuditRepository().record({
      actorId: userId,
      actorEmail: email,
      action: 'personal_learning.learner_view',
      entityType: 'user',
      entityId: query.data.user_id,
      details: {
        window: query.data.window,
        pipeline_status: query.data.pipeline_status ?? 'any',
        progress_status: query.data.progress_status ?? 'any',
        limit: String(query.data.limit),
        page: query.data.cursor ? 'next' : 'first',
      },
    });
  } catch (error) {
    logger.error({ error }, 'Learner view audit write failed; withholding learner data');
    return apiErr('internal_error', 'Learner subjects are unavailable', 500);
  }

  return apiOk(parsed.data.data, 200, { headers: NO_STORE_HEADERS });
});
