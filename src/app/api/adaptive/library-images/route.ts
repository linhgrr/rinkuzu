import { apiErr, apiOk } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import {
  adaptiveLibraryImagesQuerySchema,
  type AdaptiveLibraryImagesDto,
} from '@/dtos/adaptive-library';
import { NekosApiContractError, parseNekosApiImageUrls } from '@/lib/integrations/nekos-api';
import { parseSearchParams } from '@/lib/api/validated';

export const dynamic = 'force-dynamic';

const RANDOM_IMAGES_ENDPOINT = 'https://api.nekosapi.com/v4/images/random';
export async function GET(req: Request) {
  try {
    const query = parseSearchParams(req, adaptiveLibraryImagesQuerySchema);
    if (!query.ok) return query.response;
    const targetUrl = `${RANDOM_IMAGES_ENDPOINT}?rating=safe&limit=${query.data.limit}`;

    const response = await fetch(targetUrl, {
      // EXTERNAL: fixed nekosapi host + validated limit only (no caller URL).
      headers: { accept: 'application/json' },
      cache: 'no-store',
      redirect: 'manual',
    });

    if (!response.ok || response.status >= 300) {
      return apiErr(
        'upstream_error',
        'Failed to fetch library images from upstream service',
        response.status >= 300 && response.status < 400 ? 502 : response.status,
      );
    }

    const payload = await response.json();
    const images = parseNekosApiImageUrls(payload);

    const result: AdaptiveLibraryImagesDto = { images };
    return apiOk(result);
  } catch (error) {
    logger.error({ error }, 'Failed to fetch random library images');
    if (error instanceof NekosApiContractError) {
      return apiErr('upstream_error', error.message, 502);
    }
    return apiErr('upstream_error', 'Failed to fetch random library images', 500);
  }
}
