export const USER_ROLES = ['admin', 'user'] as const;

export type UserRole = (typeof USER_ROLES)[number];
