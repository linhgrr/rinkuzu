import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import type { AvatarUploadDto } from '@/dtos/account';
import { AVATAR_ALLOWED_MEDIA_TYPES, AVATAR_MAX_FILE_SIZE } from '@/shared/constants/avatar';
import { getAccountService } from '@/lib/account-factory';

const accountService = getAccountService();

export const PUT = withAuth(async (request: NextRequest, { email }) => {
  if (!email) return apiErr('unauthorized', 'Authentication required', 401);
  const file = (await request.formData()).get('avatar');
  if (!(file instanceof File)) {
    return apiErr('validation_error', 'No file provided', 400);
  }
  if (!AVATAR_ALLOWED_MEDIA_TYPES.some((mediaType) => mediaType === file.type)) {
    return apiErr('validation_error', 'Only JPG, PNG, and WebP images are allowed', 400);
  }
  if (file.size > AVATAR_MAX_FILE_SIZE) {
    return apiErr('validation_error', 'File size must be less than 2MB', 400);
  }

  const avatar: AvatarUploadDto = {
    bytes: new Uint8Array(await file.arrayBuffer()),
    contentType: file.type as AvatarUploadDto['contentType'],
  };
  const result = await accountService.uploadAvatar(email, avatar);
  if (
    !result.success &&
    result.statusCode === 500 &&
    result.error === 'Image upload not configured'
  ) {
    return apiErr('configuration_error', result.error, 500);
  }
  return result.success ? apiOk(result.data) : apiServiceErr(result);
});

export const DELETE = withAuth(async (_request, { email }) => {
  if (!email) return apiErr('unauthorized', 'Authentication required', 401);
  const result = await accountService.deleteAvatar(email);
  return result.success
    ? apiOk(null, 200, { meta: { message: 'Avatar removed' } })
    : apiServiceErr(result);
});
