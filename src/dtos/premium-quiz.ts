import { z } from 'zod';
import { objectIdRouteParamSchema } from '@/lib/validation/common';
import { quizProgressAnswerSchema } from '@/dtos/quiz';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const premiumSubmissionIdParamsSchema = z.strictObject({
  id: objectIdRouteParamSchema,
});

export const premiumQuizIdParamsSchema = z.strictObject({
  id: objectIdRouteParamSchema,
});

export const premiumQuizSlugParamsSchema = z.strictObject({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(240)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export const premiumSessionIdParamsSchema = z.strictObject({
  sessionId: objectIdRouteParamSchema,
});

export const createPremiumSubmissionRequestSchema = z.strictObject({
  quizId: objectIdRouteParamSchema,
  rightsAttested: z.literal(true),
});

export const premiumSubmissionListQuerySchema = z.strictObject({
  status: z.enum(['pending', 'changes_requested', 'rejected', 'approved', 'withdrawn']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const premiumCatalogListQuerySchema = z.strictObject({
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export const premiumReviewCallbackRequestSchema = z.strictObject({
  jobId: z.string().trim().min(1).max(200),
  snapshotHash: sha256Schema,
  status: z.enum(['queued', 'running', 'completed', 'failed']),
  result: z
    .strictObject({
      verdict: z.enum(['pass', 'needs_review', 'fail']),
      score: z.number().min(0).max(100),
      suggestedCredits: z.number().int().min(1).max(5),
      groundingAvailable: z.boolean(),
      summary: z.string().trim().min(1).max(4000),
      criteria: z.array(
        z.strictObject({
          key: z.string().trim().min(1).max(100),
          score: z.number().min(0).max(100),
          note: z.string().trim().max(2000),
        }),
      ),
      issues: z.array(
        z.strictObject({
          questionIndex: z.number().int().min(0).optional(),
          severity: z.enum(['info', 'warning', 'error']),
          code: z.string().trim().min(1).max(100),
          message: z.string().trim().min(1).max(2000),
        }),
      ),
    })
    .optional(),
  error: z.string().trim().min(1).max(4000).optional(),
});

export const decidePremiumSubmissionRequestSchema = z
  .strictObject({
    decision: z.enum(['approve', 'request_changes', 'reject']),
    credits: z.number().int().min(0).max(5).default(0),
    note: z.string().trim().max(4000).optional(),
    overrideReason: z.string().trim().min(10).max(4000).optional(),
  })
  .superRefine((value, context) => {
    if (value.decision === 'approve' && value.credits === 0) {
      context.addIssue({
        code: 'custom',
        path: ['credits'],
        message: 'Admin must select 1–5 credits; duplicate rewards are forced to zero atomically',
      });
    }
    if (value.decision !== 'approve' && value.credits !== 0) {
      context.addIssue({
        code: 'custom',
        path: ['credits'],
        message: 'Only approved submissions can receive credits',
      });
    }
  });

export const unlockPremiumQuizRequestSchema = z.strictObject({
  idempotencyKey: z.uuid(),
});

export const premiumSessionBatchRequestSchema = z.strictObject({
  cursor: z.string().trim().min(16).max(512),
});

export const premiumSessionProgressRequestSchema = z.strictObject({
  questionIndex: z.number().int().min(0),
  answer: quizProgressAnswerSchema,
});

export const premiumSessionSubmitRequestSchema = z.strictObject({
  idempotencyKey: z.uuid(),
});

export type DecidePremiumSubmissionRequestDto = z.infer<
  typeof decidePremiumSubmissionRequestSchema
>;
export type PremiumReviewCallbackRequestDto = z.infer<typeof premiumReviewCallbackRequestSchema>;
