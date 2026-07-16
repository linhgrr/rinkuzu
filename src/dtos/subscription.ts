import { z } from 'zod';

export const verifySubscriptionRequestSchema = z.strictObject({
  orderCode: z.union([
    z.number().int().positive().safe(),
    z.string().trim().regex(/^\d+$/, 'Order code must be a positive integer'),
  ]),
});

const payosWebhookScalarSchema = z.union([z.string(), z.number()]);

export const payosWebhookDataSchema = z
  .object({
    orderCode: payosWebhookScalarSchema.optional(),
    amount: payosWebhookScalarSchema.optional(),
    reference: z.string().optional(),
    code: z.string().optional(),
  })
  .catchall(z.unknown());

export const payosWebhookRequestSchema = z.strictObject({
  code: z.string().optional(),
  success: z.boolean().optional(),
  data: payosWebhookDataSchema,
  signature: z.string().min(1),
});

export interface SubscriptionPlanDto {
  id: string;
  name: string;
  price: number;
  duration: string;
  features: string[];
}

export interface PaymentRequestDto {
  orderCode: number;
  paymentUrl: string;
  qrCode?: string;
  amount: number;
  plan: SubscriptionPlanDto;
}

export interface VerifiedPaymentDto {
  orderCode: string | number;
  amount: string | number;
  reference?: string;
  status?: string;
  code?: string;
}

export interface SubscriptionActivationDto {
  success: boolean;
  subscription: {
    type: string;
    startDate: Date;
    endDate?: Date;
    isActive: boolean;
  };
}

export interface SubscriptionCancellationDto {
  success: boolean;
}

export interface SubscriptionPlanViewDto extends SubscriptionPlanDto {
  durationDisplay: string;
  isLifetime: boolean;
  calculatedMonths?: number;
}

export interface SubscriptionPlansResponseDto {
  plans: SubscriptionPlanViewDto[];
  meta: {
    durationFormat: 'ISO8601';
    supportedDurations: string[];
  };
}

export interface SubscriptionStatusResponseDto {
  subscription: {
    type?: string;
    startDate?: string;
    endDate?: string;
    isActive?: boolean;
    status?: string;
    payosOrderId?: string;
    payosTransactionId?: string;
  } | null;
  isPremium: boolean;
}

export type VerifySubscriptionRequestDto = z.infer<typeof verifySubscriptionRequestSchema>;
export type PayOSWebhookRequestDto = z.infer<typeof payosWebhookRequestSchema>;
