import { z } from 'zod';
import type { AvatarAllowedMediaType } from '@/shared/constants/avatar';

export const updateProfileRequestSchema = z.object({
  displayName: z.string().trim().max(50, 'Display name must be at most 50 characters').optional(),
  bio: z.string().trim().max(160, 'Bio must be at most 160 characters').optional(),
});

export interface AccountSubscriptionDto {
  type: string;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  payosOrderId?: string;
  payosTransactionId?: string;
}

export interface AccountProfileDto {
  email: string;
  displayName?: string;
  bio?: string;
  avatar?: string;
  role: 'admin' | 'user';
  createdAt: string;
  subscription?: AccountSubscriptionDto;
}

export interface UpdateAccountProfileDto {
  displayName?: string;
  bio?: string;
}

export interface AvatarUploadDto {
  bytes: Uint8Array;
  contentType: AvatarAllowedMediaType;
}

export interface AvatarResponseDto {
  avatar: string;
}

export interface PasswordChangeResultDto {
  email: string;
  passwordChanged: true;
}

export interface AvatarDeleteResultDto {
  email: string;
  avatar: null;
  deleted: true;
}
