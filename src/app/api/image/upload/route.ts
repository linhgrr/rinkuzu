import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk } from '@/lib/api/response';
import { logger } from '@/lib/logger';

const IMGBB_API_URL = 'https://api.imgbb.com/1/upload';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const POST = withAuth(async (request: NextRequest) => {
  const apiKey = process.env['IMGBB_API_KEY'];
  if (!apiKey) {
    return apiErr('configuration_error', 'Image upload not configured', 500);
  }

  const formData = await request.formData();
  const file = formData.get('image') as File | null;
  const name = formData.get('name') as string | null;

  if (!file) {
    return apiErr('validation_error', 'No image provided', 400);
  }

  if (!file.type.startsWith('image/')) {
    return apiErr('validation_error', 'File must be an image', 400);
  }

  if (file.size > MAX_FILE_SIZE) {
    return apiErr('validation_error', 'File size must be less than 10MB', 400);
  }

  const upstream = new FormData();
  upstream.append('key', apiKey);
  upstream.append('image', file, name ?? file.name);
  if (name) upstream.append('name', name);

  const response = await fetch(IMGBB_API_URL, {
    method: 'POST',
    body: upstream,
    cache: 'no-store',
    signal: AbortSignal.timeout(30_000),
  });

  const json = (await response.json()) as {
    success: boolean;
    data?: {
      id: string;
      url: string;
      display_url: string;
      delete_url: string;
      thumb?: { url: string };
      medium?: { url: string };
      width: number;
      height: number;
      size: number;
    };
  };

  if (!response.ok || !json.success || !json.data) {
    logger.error({ json }, 'ImgBB upload failed');
    return apiErr('upstream_error', 'Image upload failed', 502);
  }

  const d = json.data;
  return apiOk({
    id: d.id,
    url: d.url,
    displayUrl: d.display_url,
    thumbnailUrl: d.thumb?.url ?? d.display_url,
    mediumUrl: d.medium?.url,
    deleteUrl: d.delete_url,
    width: d.width,
    height: d.height,
    size: d.size,
  });
});
