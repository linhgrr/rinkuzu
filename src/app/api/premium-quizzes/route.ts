import { premiumCatalogListQuerySchema } from '@/dtos/premium-quiz';
import { apiOk } from '@/lib/api/response';
import { PREMIUM_PRIVATE_HEADERS } from '@/lib/api/premium-quiz';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';
import { parseSearchParams } from '@/lib/api/validated';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const query = parseSearchParams(request, premiumCatalogListQuerySchema);
  if (!query.ok) return query.response;
  const result = await getPremiumQuizService().listCatalog(query.data);
  return apiOk(result, 200, { headers: PREMIUM_PRIVATE_HEADERS });
}
