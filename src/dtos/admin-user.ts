import { z } from 'zod';
import type { PaginationMeta } from '@/dtos/common';
import { objectIdSchema } from '@/lib/validation/common';

export const userRoleSchema = z.enum(['admin', 'user']);

export const adminUserListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(200).optional(),
  role: userRoleSchema.optional(),
});

export const updateAdminUserRoleRequestSchema = z
  .object({
    userId: objectIdSchema,
    role: userRoleSchema,
  })
  .strict();

export const deleteAdminUserQuerySchema = z.object({
  userId: objectIdSchema,
});

export interface AdminUserSubscriptionDto {
  type: string;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
}

export interface AdminUserDto {
  id: string;
  email: string;
  displayName?: string;
  role: z.infer<typeof userRoleSchema>;
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

export type AdminUserListQueryDto = z.infer<typeof adminUserListQuerySchema>;
export type UpdateAdminUserRoleRequestDto = z.infer<typeof updateAdminUserRoleRequestSchema>;
