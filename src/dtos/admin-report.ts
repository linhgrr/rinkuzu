import { z } from 'zod';
import type { PaginationMeta } from '@/dtos/common';
import { objectIdSchema } from '@/lib/validation/common';

const adminReportStatusSchema = z.enum(['pending', 'resolved', 'dismissed']);
const adminReportFilterSchema = z.enum(['all', 'pending', 'resolved', 'dismissed']);
export type AdminReportStatusDto = z.infer<typeof adminReportStatusSchema>;

export const adminReportListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: adminReportFilterSchema.default('all'),
});

export const adminReportIdParamsSchema = z.object({
  id: objectIdSchema,
});

export const updateAdminReportRequestSchema = z.strictObject({
  status: adminReportStatusSchema,
  adminNotes: z.string().trim().max(1000).optional(),
});

export interface AdminReportDto {
  id: string;
  quizId: string;
  quizTitle: string;
  quizSlug: string;
  reporterEmail: string;
  reporterName: string;
  content: string;
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
}

export type AdminReportListQueryDto = z.infer<typeof adminReportListQuerySchema>;
export type UpdateAdminReportRequestDto = z.infer<typeof updateAdminReportRequestSchema>;
