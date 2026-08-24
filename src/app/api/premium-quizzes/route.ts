import { premiumCatalogListQuerySchema } from '@/dtos/premium-quiz';
import { apiErr, apiOk } from '@/lib/api/response';
import { PREMIUM_PRIVATE_HEADERS } from '@/lib/api/premium-quiz';
import { readAndValidateSearchParams } from '@/lib/api/request';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const query = readAndValidateSearchParams(request, premiumCatalogListQuerySchema);
  if (!query.success) {
    return apiErr('validation_error', query.error, 400, { fields: query.fields });
  }
  const result = await getPremiumQuizService().listCatalog(query.data);
  return apiOk(result, 200, { headers: PREMIUM_PRIVATE_HEADERS });
}
