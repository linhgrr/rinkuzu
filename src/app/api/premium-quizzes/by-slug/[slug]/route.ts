import { premiumQuizSlugParamsSchema } from '@/dtos/premium-quiz';
import { apiErr, apiOk } from '@/lib/api/response';
import { withOptionalAuth } from '@/lib/api/auth';
import { PREMIUM_PRIVATE_HEADERS } from '@/lib/api/premium-quiz';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';
import { parseRouteParams } from '@/lib/api/validated';

export const dynamic = 'force-dynamic';

export const GET = withOptionalAuth<{ slug: string }>(async (_request, { params }) => {
  const parsed = parseRouteParams(params, premiumQuizSlugParamsSchema);
  if (!parsed.ok) return parsed.response;
  const metadata = await getPremiumQuizService().getCatalogMetadataBySlug(parsed.data.slug);
  if (!metadata) return apiErr('not_found', 'Premium quiz not found', 404);
  return apiOk(metadata, 200, { headers: PREMIUM_PRIVATE_HEADERS });
});
