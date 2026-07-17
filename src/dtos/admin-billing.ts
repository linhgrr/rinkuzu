import { z } from 'zod';
import { DurationUtils } from '@/types/subscription';
import { objectIdRouteParamSchema, objectIdSchema } from '@/lib/validation/common';
import type { PaginationMeta } from '@/dtos/common';

export const adminSubscriptionIdRouteParamsSchema = z.strictObject({
  id: objectIdRouteParamSchema,
});

const planIdSchema = z.string().trim().min(1, 'Plan ID is required').max(120);

const durationSchema = z
  .string()
  .trim()
  .refine((value) => DurationUtils.isValidISO8601Duration(value), 'Invalid duration format');

const featuresSchema = z.array(z.string()).transform((features) => {
  const cleaned: string[] = [];
  for (const feature of features) {
    const trimmed = feature.trim();
    if (trimmed.length > 0) cleaned.push(trimmed);
  }
  return cleaned;
});

export const createPaymentRequestSchema = z.object({
  planId: planIdSchema,
});

export const createPlanRequestSchema = z.object({
  name: z.string().trim().min(1, 'Plan name is required').max(80),
  price: z.number().finite().positive('Plan price must be greater than 0'),
  duration: durationSchema,
  features: featuresSchema.default([]),
  isActive: z.boolean().default(true),
});

export const updatePlanRequestSchema = z
  .object({
    id: planIdSchema,
    name: z.string().trim().min(1, 'Plan name is required').max(80).optional(),
    price: z.number().finite().positive('Plan price must be greater than 0').optional(),
    duration: durationSchema.optional(),
    features: featuresSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    ({ id: _id, ...update }) => Object.values(update).some((value) => value !== undefined),
    'No valid plan fields provided',
  );

export const deletePlanRequestSchema = z.object({
  id: planIdSchema,
});

export const grantUserSubscriptionRequestSchema = z.object({
  userId: objectIdSchema,
  planId: planIdSchema,
});

const subscriptionStatusSchema = z.enum(['pending', 'completed', 'failed', 'cancelled', 'expired']);

type SubscriptionStatusDto = z.infer<typeof subscriptionStatusSchema>;

export const adminSubscriptionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: subscriptionStatusSchema.optional(),
  search: z.string().trim().max(200).optional(),
});

export const updateSubscriptionRequestSchema = z.strictObject({
  status: z.enum(['failed', 'cancelled', 'expired']),
});

export interface BillingPlanDto {
  id: string;
  name: string;
  price: number;
  duration: string;
  features: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSubscriptionDto {
  id: string;
  user: string;
  userEmail: string;
  type: string;
  amount: number;
  currency: string;
  status: SubscriptionStatusDto;
  payosOrderId: string;
  payosTransactionId?: string;
  payosPaymentUrl?: string;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSubscriptionListDto {
  subscriptions: AdminSubscriptionDto[];
  pagination: PaginationMeta;
}

export interface AdminUserSubscriptionGrantDto {
  user: string;
  plan: string;
  startDate: string;
  endDate?: string;
  isActive: true;
}

export type CreatePlanRequestDto = z.infer<typeof createPlanRequestSchema>;
export type UpdatePlanRequestDto = z.infer<typeof updatePlanRequestSchema>;
export type GrantUserSubscriptionRequestDto = z.infer<typeof grantUserSubscriptionRequestSchema>;
export type AdminSubscriptionListQueryDto = z.infer<typeof adminSubscriptionListQuerySchema>;
export type UpdateSubscriptionRequestDto = z.infer<typeof updateSubscriptionRequestSchema>;
