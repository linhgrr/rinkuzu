import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAdmin } from '@/lib/api/auth';
import { parseSearchParams } from '@/lib/api/validated';
import { apiForward } from '@/lib/api/response';
import { isRecord, isStandardSuccessEnvelope } from '@/lib/api/envelope';
import { personalLearningSubjectsQuerySchema } from '@/dtos/admin-personal-learning';
import { getAdminUserIdentityService } from '@/lib/admin-user-identity-factory';

export const dynamic = 'force-dynamic';

/** Upstream ORs `search` with `user_ids`, so a name/email hit widens the page. */
const MAX_MATCHED_USER_IDS = 100;

const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store',
  Pragma: 'no-cache',
} as const;

function subjectUserIds(payload: unknown): string[] {
  if (!isRecord(payload) || !Array.isArray(payload['subjects'])) return [];
  return payload['subjects'].flatMap((row) =>
    isRecord(row) && typeof row['user_id'] === 'string' ? [row['user_id']] : [],
  );
}

export const GET = withAdmin(async (req, { userId, session }) => {
  const query = parseSearchParams(req, personalLearningSubjectsQuerySchema);
  if (!query.ok) return query.response;

  const identityService = getAdminUserIdentityService();
  const upstreamUrl = new URL(req.url);
  upstreamUrl.search = '';
  for (const [key, value] of Object.entries(query.data)) {
    if (value !== undefined) upstreamUrl.searchParams.set(key, String(value));
  }
  if (query.data.search) {
    const matchedIds = await identityService.findUserIdsByNameOrEmail(
      query.data.search,
      MAX_MATCHED_USER_IDS,
    );
    for (const matchedId of matchedIds) upstreamUrl.searchParams.append('user_ids', matchedId);
  }

  const response = await proxyAdaptiveRequest(
    new Request(upstreamUrl, { method: 'GET', headers: req.headers, signal: req.signal }),
    '/admin/personal-learning/subjects',
    { userId, userRole: session.user.role },
  );

  const payload: unknown = await response.json().catch(() => null);
  if (!isStandardSuccessEnvelope<Record<string, unknown>>(payload)) {
    const forwarded = apiForward(
      payload === null
        ? { success: false, error: { code: 'bad_gateway', message: 'Upstream analytics failed' } }
        : (payload as Parameters<typeof apiForward>[0]),
      response.status === 200 ? 502 : response.status,
    );
    for (const [key, value] of Object.entries(NO_STORE_HEADERS)) {
      forwarded.headers.set(key, value);
    }
    return forwarded;
  }

  const identities = await identityService.getUserIdentities(subjectUserIds(payload.data));
  const subjects = Array.isArray(payload.data['subjects']) ? payload.data['subjects'] : [];
  const enriched = apiForward(
    {
      ...payload,
      data: {
        ...payload.data,
        subjects: subjects.map((row) => {
          if (!isRecord(row)) return row;
          const identity =
            typeof row['user_id'] === 'string' ? identities.get(row['user_id']) : undefined;
          return {
            ...row,
            display_name: identity?.displayName ?? null,
            email: identity?.email ?? null,
          };
        }),
      },
    },
    response.status,
  );
  for (const [key, value] of Object.entries(NO_STORE_HEADERS)) {
    enriched.headers.set(key, value);
  }
  return enriched;
});
