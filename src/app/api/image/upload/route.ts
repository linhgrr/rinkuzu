import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { apiErr } from '@/lib/api/response';
import { IMAGE_UPLOAD_MAX_FILE_SIZE } from '@/dtos/image';
import { getImageService } from '@/lib/image-factory';
import { imageUploadResponse } from '@/lib/api/image-response';

const imageService = getImageService();

export const POST = withAuth(async (request: NextRequest) => {
  const formData = await request.formData();
  const file = formData.get('image');
  const name = formData.get('name');

  if (!(file instanceof File)) {
    return apiErr('validation_error', 'No image provided', 400);
  }

  if (!file.type.startsWith('image/')) {
    return apiErr('validation_error', 'File must be an image', 400);
  }

  if (file.size > IMAGE_UPLOAD_MAX_FILE_SIZE) {
    return apiErr('validation_error', 'File size must be less than 10MB', 400);
  }

  const result = await imageService.uploadImage({
    kind: 'question',
    bytes: new Uint8Array(await file.arrayBuffer()),
    contentType: file.type,
    filename: typeof name === 'string' && name ? name : file.name,
  });
  return imageUploadResponse(result);
});
