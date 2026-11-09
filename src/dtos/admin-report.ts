import { z } from 'zod';
import type { PaginationMeta } from '@/dtos/common';
import { objectIdSchema } from '@/lib/validation/common';
import { REPORT_STATUSES } from '@/shared/constants/report-status';
import {
  REPORT_REASONS,
  type ReportReason,
  type ReportSource,
} from '@/shared/constants/report-reason';
import type { QuestionType } from '@/shared/constants/question-type';
import { quizQuestionInputSchema } from '@/lib/validation/question';

const adminReportStatusSchema = z.enum(REPORT_STATUSES);
const adminReportFilterSchema = z.enum(['all', ...REPORT_STATUSES]);
export type AdminReportStatusDto = z.infer<typeof adminReportStatusSchema>;

export const adminReportListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: adminReportFilterSchema.default('all'),
  reason: z.enum(['all', ...REPORT_REASONS]).default('all'),
});

export const hideReportedQuizRequestSchema = z.strictObject({
  adminNotes: z.string().trim().max(1000).optional(),
});

export const adminReportIdParamsSchema = z.object({
  id: objectIdSchema,
});

export const updateAdminReportRequestSchema = z.strictObject({
  status: adminReportStatusSchema,
  adminNotes: z.string().trim().max(1000).optional(),
});

export const updateAdminReportedQuestionRequestSchema = quizQuestionInputSchema;

export interface AdminReportedQuestionDto {
  id: string;
  index: number;
  question: string;
  options: string[];
  type: QuestionType;
  correctIndex?: number;
  correctIndexes?: number[];
  questionImage?: string;
  optionImages?: (string | undefined)[];
}

export interface AdminReportDto {
  id: string;
  quizId: string;
  quizTitle: string;
  quizSlug: string;
  questionId?: string;
  questionSnapshot?: AdminReportedQuestionDto;
  reporterEmail: string;
  reporterName: string;
  content: string;
  /** Set on quiz-page reports (RIN-1343); per-question reports have none. */
  reason?: ReportReason;
  source?: ReportSource;
  status: AdminReportStatusDto;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  adminNotes?: string;
}

export interface AdminReportListDto {
  reports: AdminReportDto[];
  pagination: PaginationMeta;
  /** Pending copyright/personal-data reports across all quizzes (RIN-1343). */
  pendingIndexHoldCount: number;
}

export type AdminReportListQueryDto = z.infer<typeof adminReportListQuerySchema>;
export type UpdateAdminReportRequestDto = z.infer<typeof updateAdminReportRequestSchema>;
export type UpdateAdminReportedQuestionRequestDto = z.infer<
  typeof updateAdminReportedQuestionRequestSchema
>;
