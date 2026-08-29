import { z } from 'zod';
import { EXCESS_RESOLUTION_COMMANDS } from '@/services/billing/domain/excess-resolution';
import {
  MONEY_ADJUSTMENT_TYPES,
  MONEY_ALLOCATIONS,
} from '@/services/billing/domain/settlement-math';

export const billingQuoteRequestSchema = z.strictObject({
  planId: z.string().trim().min(1).max(100),
  promoCode: z.string().trim().max(64).nullable().optional(),
});

export const createBillingOrderRequestSchema = z.strictObject({
  quoteToken: z.string().min(32).max(4_096),
});

export const billingOrderParamsSchema = z.strictObject({
  orderId: z.uuid(),
});

export const externalMoneyAdjustmentSchema = z.strictObject({
  orderId: z.uuid(),
  // Taken from the money algebra rather than restated, so an adjustment type
  // the ledger understands can never be one this endpoint silently refuses.
  type: z.enum(MONEY_ADJUSTMENT_TYPES),
  externalReference: z.string().trim().min(1).max(200),
  amount: z.number().int().positive().safe(),
  currency: z.literal('VND'),
  allocation: z.enum(MONEY_ALLOCATIONS),
  occurredAt: z.iso.datetime(),
});

/**
 * An operator's verdict on an overpayment. The reason is required because this
 * is the one billing transition with no machine-checkable justification: the
 * audit trail is the only record of why the money went where it did.
 */
export const resolveOrderExcessSchema = z.strictObject({
  orderId: z.uuid(),
  command: z.enum(EXCESS_RESOLUTION_COMMANDS),
  reason: z.string().trim().min(3).max(1_000),
});

export const billingWebhookParamsSchema = z.strictObject({
  provider: z.literal('payos'),
});

export const promotionCreateSchema = z
  .strictObject({
    code: z.string().trim().min(3).max(32),
    description: z.string().trim().max(500).optional(),
    kind: z.enum(['percentage', 'fixed']),
    percentageOff: z.number().int().min(1).max(100).optional(),
    percentageCap: z.number().int().positive().safe().optional(),
    fixedAmount: z.number().int().positive().safe().optional(),
    currency: z.literal('VND').optional(),
    minimumSubtotal: z.number().int().nonnegative().safe().default(0),
    eligibilityClass: z.enum(['public', 'first_purchase']),
    totalLimit: z.number().int().positive().optional(),
    perUserLimit: z.number().int().positive().default(1),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
  })
  .superRefine((input, ctx) => {
    if (input.kind === 'percentage' && input.percentageOff === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['percentageOff'],
        message: 'percentageOff is required',
      });
    }
    if (input.kind === 'percentage' && input.fixedAmount !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['fixedAmount'],
        message: 'fixedAmount is not allowed',
      });
    }
    if (input.kind === 'fixed' && input.fixedAmount === undefined) {
      ctx.addIssue({ code: 'custom', path: ['fixedAmount'], message: 'fixedAmount is required' });
    }
    if (
      input.kind === 'fixed' &&
      (input.percentageOff !== undefined || input.percentageCap !== undefined)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['percentageOff'],
        message: 'percentage fields are not allowed',
      });
    }
    if (new Date(input.startsAt).getTime() >= new Date(input.endsAt).getTime()) {
      ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'endsAt must be after startsAt' });
    }
  });
