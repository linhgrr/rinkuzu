import { apiErr, apiOk } from '@/lib/api/response';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const RANDOM_IMAGES_ENDPOINT = 'https://api.nekosapi.com/v4/images/random';
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 100;

const toPositiveInt = (value: string | null, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(MAX_LIMIT, Math.floor(parsed));
};

const extractImageUrl = (item: unknown): string | null => {
  if (!item || typeof item !== 'object') return null;

  const record = item as Record<string, unknown>;
  const direct = [record['image_url'], record['url'], record['imageUrl'], record['src']].find(
    (value) => typeof value === 'string' && value.length > 0,
  );
  if (typeof direct === 'string') return direct;

  const image = record['image'];
  if (image && typeof image === 'object') {
    const nested = image as Record<string, unknown>;
    const nestedUrl = [nested['url'], nested['image_url'], nested['src']].find(
      (value) => typeof value === 'string' && value.length > 0,
    );
    if (typeof nestedUrl === 'string') return nestedUrl;
  }

  return null;
};

const collectImageUrls = (items: unknown[]): string[] => {
  const urls: string[] = [];
  for (const item of items) {
    const url = extractImageUrl(item);
    if (url) {
      urls.push(url);
    }
  }
  return urls;
};

const normalizePayload = (payload: unknown): string[] => {
  if (Array.isArray(payload)) return collectImageUrls(payload);

  if (!payload || typeof payload !== 'object') return [];

  const record = payload as Record<string, unknown>;
  const candidateArrays = [record['items'], record['images'], record['data']];
  for (const candidate of candidateArrays) {
    if (Array.isArray(candidate)) return collectImageUrls(candidate);
  }

  const singleUrl = extractImageUrl(record);
  return singleUrl ? [singleUrl] : [];
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = toPositiveInt(searchParams.get('limit'), DEFAULT_LIMIT);
    const targetUrl = `${RANDOM_IMAGES_ENDPOINT}?rating=safe&limit=${limit}`;

    const response = await fetch(targetUrl, {
      // EXTERNAL: image proxy
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      return apiErr(
        'upstream_error',
        'Failed to fetch library images from upstream service',
        response.status,
      );
    }

    const payload = await response.json();
    const images = normalizePayload(payload);

    return apiOk({ images });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch random library images');
    return apiErr('upstream_error', 'Failed to fetch random library images', 500);
  }
}
