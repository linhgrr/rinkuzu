import { z } from 'zod';
import { env } from '@/lib/env';
import {
  ImageStorageConfigurationError,
  ImageStorageUpstreamError,
  type IImageStorage,
  type ImageUpload,
  type ImageUploadResult,
} from '@/interfaces/services/IImageStorage';

const IMGBB_API_URL = 'https://api.imgbb.com/1/upload';

const imgbbResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string(),
    url: z.url(),
    display_url: z.url(),
    delete_url: z.url(),
    thumb: z.object({ url: z.url() }).optional(),
    medium: z.object({ url: z.url() }).optional(),
    width: z.number(),
    height: z.number(),
    size: z.number(),
  }),
});

function isHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export class ImgBbImageStorage implements IImageStorage {
  async upload(image: ImageUpload): Promise<ImageUploadResult> {
    if (!env.IMGBB_API_KEY) {
      throw new ImageStorageConfigurationError();
    }

    const formData = new FormData();
    const bytes = new Uint8Array(image.bytes.byteLength);
    bytes.set(image.bytes);
    formData.append('key', env.IMGBB_API_KEY);
    formData.append('image', new Blob([bytes.buffer], { type: image.contentType }), image.filename);

    const response = await fetch(IMGBB_API_URL, {
      method: 'POST',
      body: formData,
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });
    const payload: unknown = await response.json();
    const parsed = imgbbResponseSchema.safeParse(payload);
    if (!response.ok || !parsed.success) {
      throw new ImageStorageUpstreamError();
    }
    const data = parsed.data.data;
    return {
      id: data.id,
      url: data.url,
      displayUrl: data.display_url,
      thumbnailUrl: data.thumb?.url ?? data.display_url,
      ...(data.medium?.url !== undefined && { mediumUrl: data.medium.url }),
      deleteUrl: data.delete_url,
      width: data.width,
      height: data.height,
      size: data.size,
    };
  }

  /**
   * Best-effort ImgBB delete via the provider-issued delete URL.
   * Empty / non-HTTPS URLs are no-ops. HTTP 404 is treated as already-deleted (idempotent).
   */
  async deleteByUrl(deleteUrl: string): Promise<void> {
    if (typeof deleteUrl !== 'string' || deleteUrl.length === 0) return;
    if (!isHttpsUrl(deleteUrl)) return;

    const response = await fetch(deleteUrl, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    if (response.ok || response.status === 404) return;
    throw new ImageStorageUpstreamError('Image delete failed');
  }
}
