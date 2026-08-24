import { premiumQuizSlugParamsSchema } from '@/dtos/premium-quiz';
import { apiErr, apiOk } from '@/lib/api/response';
import { withOptionalAuth } from '@/lib/api/auth';
import { PREMIUM_PRIVATE_HEADERS } from '@/lib/api/premium-quiz';
import { readAndValidateRouteParams } from '@/lib/api/request';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';

export const dynamic = 'force-dynamic';

export const GET = withOptionalAuth<{ slug: string }>(async (_request, { params }) => {
  const parsed = readAndValidateRouteParams(params, premiumQuizSlugParamsSchema);
  if (!parsed.success) {
    return apiErr('validation_error', parsed.error, 400, { fields: parsed.fields });
  }
  const metadata = await getPremiumQuizService().getCatalogMetadataBySlug(parsed.data.slug);
  if (!metadata) return apiErr('not_found', 'Premium quiz not found', 404);
  return apiOk(metadata, 200, { headers: PREMIUM_PRIVATE_HEADERS });
});
