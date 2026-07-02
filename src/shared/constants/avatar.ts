export const AVATAR_MAX_FILE_SIZE = 2 * 1024 * 1024;
export const AVATAR_ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type AvatarAllowedMediaType = (typeof AVATAR_ALLOWED_MEDIA_TYPES)[number];
