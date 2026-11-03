import { premiumQuizSlugParamsSchema } from '@/dtos/premium-quiz';
import { apiOk } from '@/lib/api/response';
import { withOptionalAuth } from '@/lib/api/auth';
import { PREMIUM_PRIVATE_HEADERS } from '@/lib/api/premium-quiz';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';
import { parseRouteParams } from '@/lib/api/validated';

export const dynamic = 'force-dynamic';

export const GET = withOptionalAuth<{ slug: string }>(async (_request, { params }) => {
  const parsed = parseRouteParams(params, premiumQuizSlugParamsSchema);
  if (!parsed.ok) return parsed.response;
  const metadata = await getPremiumQuizService().getCatalogMetadataBySlug(parsed.data.slug);
  // "Not premium" is the common answer (every normal flashcard page asks), so it is
  // 200 with null data rather than a 404 the browser logs as a failed request (RIN-798).
  return apiOk(metadata ?? null, 200, { headers: PREMIUM_PRIVATE_HEADERS });
});
