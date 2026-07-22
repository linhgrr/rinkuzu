import { z } from 'zod';
import type { PaginationMeta } from '@/dtos/common';
import { objectIdSchema } from '@/lib/validation/common';
import {
  ACCOUNT_DISABLE_ACTIVE,
  ACCOUNT_DISABLE_DISABLED,
} from '@/shared/constants/account-disable';
import { USER_ROLES } from '@/shared/constants/user-role';

const userRoleSchema = z.enum(USER_ROLES);

const accountDisableSchema = z.union([
  z.literal(ACCOUNT_DISABLE_ACTIVE),
  z.literal(ACCOUNT_DISABLE_DISABLED),
]);

export const adminUserListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(200).optional(),
  role: userRoleSchema.optional(),
  /** active = disable 0, disabled = disable 1, all = no filter. */
  status: z.enum(['active', 'disabled', 'all']).default('all'),
});

export const updateAdminUserRoleRequestSchema = z.strictObject({
  userId: objectIdSchema,
  role: userRoleSchema,
});

export const adminUserIdRouteParamsSchema = z.object({
  userId: objectIdSchema,
});

export const updateAdminUserStatusRequestSchema = z.strictObject({
  disable: accountDisableSchema,
});

export interface AdminUserSubscriptionDto {
  plan: {
    id: string;
    name: string;
  };
  startDate?: string;
  endDate?: string;
  isActive: boolean;
}

export interface AdminUserDto {
  id: string;
  email: string;
  displayName?: string;
  role: z.infer<typeof userRoleSchema>;
  disable: z.infer<typeof accountDisableSchema>;
  disabledAt?: string | null;
  createdAt: string;
  subscription?: AdminUserSubscriptionDto;
}

export interface AdminUserListDto {
  users: AdminUserDto[];
  pagination: PaginationMeta;
}

export interface AdminMessageDto {
  message: string;
}

export interface AdminUserStatusDto {
  id: string;
  disable: z.infer<typeof accountDisableSchema>;
  changed: boolean;
  disabledAt?: string | null;
  message: string;
}

export type AdminUserListQueryDto = z.infer<typeof adminUserListQuerySchema>;
export type UpdateAdminUserRoleRequestDto = z.infer<typeof updateAdminUserRoleRequestSchema>;
export type UpdateAdminUserStatusRequestDto = z.infer<typeof updateAdminUserStatusRequestSchema>;
