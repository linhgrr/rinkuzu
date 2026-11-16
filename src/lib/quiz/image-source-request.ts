import 'server-only';

import type { NextRequest, NextResponse } from 'next/server';

import { apiErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { getUploadCounterService } from '@/lib/upload-counter-factory';
import {
  GUEST_DRAFT_MAX_IMAGES,
  GUEST_DRAFT_MAX_IMAGE_BYTES,
  GUEST_DRAFT_MAX_IMAGES_TOTAL_BYTES,
} from '@/shared/constants/guest-draft';
import {
  uploadSizeBucket,
  type UploadRejectionReason,
  type UploadSurface,
} from '@/shared/constants/upload-counters';

/** Multipart overhead allowed on top of the photos before the body is read at all. */
const MULTIPART_SLACK_BYTES = 64 * 1024;
const JPEG_MAGIC = [0xff, 0xd8, 0xff] as const;

type ImageRefusalReason = 'too_many_images' | 'image_too_large' | 'image_unsupported' | 'no_images';

const COUNTED_REASON: Record<ImageRefusalReason, UploadRejectionReason> = {
  too_many_images: 'too_many_pages',
  image_too_large: 'too_large',
  image_unsupported: 'wrong_type',
  no_images: 'unreadable',
};

/**
 * Counts a refused photo upload (RIN-1785): surface, reason and size bucket only. Never
 * the file names or bytes. Counting is best effort and never fails the request.
 */
export async function countImageRejection(
  surface: UploadSurface,
  reason: UploadRejectionReason,
  bytes: number,
): Promise<void> {
  try {
    await getUploadCounterService().recordRejection({
      ext: 'jpg',
      reason,
      surface,
      sizeBucket: uploadSizeBucket(bytes),
    });
  } catch (error) {
    logger.warn({ errorName: (error as Error).name }, 'Upload rejection count failed');
  }
}

export type ImageUploadForm =
  { ok: true; form: FormData; images: File[] } | { ok: false; response: NextResponse };

async function isJpeg(file: File): Promise<boolean> {
  if (file.type !== 'image/jpeg') return false;
  const head = new Uint8Array(await file.slice(0, JPEG_MAGIC.length).arrayBuffer());
  return JPEG_MAGIC.every((byte, index) => head[index] === byte);
}

async function refuse(
  surface: UploadSurface,
  reason: ImageRefusalReason,
  status: number,
  bytes: number,
): Promise<{ ok: false; response: NextResponse }> {
  await countImageRejection(surface, COUNTED_REASON[reason], bytes);
  const response =
    reason === 'no_images'
      ? apiErr('validation_error', 'At least one photo is required', 400)
      : apiErr('validation_error', 'Photos refused', status, {
          reason,
          ...(reason === 'too_many_images' ? { limit_images: GUEST_DRAFT_MAX_IMAGES } : {}),
          ...(reason === 'image_too_large'
            ? { limit_mb: GUEST_DRAFT_MAX_IMAGE_BYTES / (1024 * 1024) }
            : {}),
        });
  return { ok: false, response };
}

/**
 * Reads the `images` parts of a photo-draft request and checks them before any upstream
 * call (RIN-1792): 1 to 5 JPEG parts of at most 1 MB each and 4.4 MB in all. The photos
 * are only held in memory to be forwarded; nothing here logs or stores them.
 */
export async function readImageUploadForm(
  request: NextRequest,
  surface: UploadSurface,
): Promise<ImageUploadForm> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > GUEST_DRAFT_MAX_IMAGES_TOTAL_BYTES + MULTIPART_SLACK_BYTES) {
    return refuse(surface, 'image_too_large', 413, declared);
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return refuse(surface, 'no_images', 400, 0);
  }
  const parts = form.getAll('images');
  const images = parts.filter((part): part is File => part instanceof File && part.size > 0);
  const total = images.reduce((sum, image) => sum + image.size, 0);
  if (images.length === 0 || images.length !== parts.length) {
    return refuse(surface, 'no_images', 400, total);
  }
  if (images.length > GUEST_DRAFT_MAX_IMAGES) return refuse(surface, 'too_many_images', 400, total);
  if (images.some((image) => image.size > GUEST_DRAFT_MAX_IMAGE_BYTES)) {
    return refuse(surface, 'image_too_large', 413, total);
  }
  if (total > GUEST_DRAFT_MAX_IMAGES_TOTAL_BYTES) {
    return refuse(surface, 'image_too_large', 413, total);
  }
  for (const image of images) {
    if (!(await isJpeg(image))) return refuse(surface, 'image_unsupported', 415, total);
  }
  return { ok: true, form, images };
}
