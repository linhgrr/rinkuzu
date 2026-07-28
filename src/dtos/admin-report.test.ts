import { describe, expect, it } from 'vitest';
import {
  adminReportIdParamsSchema,
  adminReportListQuerySchema,
  updateAdminReportRequestSchema,
  updateAdminReportedQuestionRequestSchema,
} from '@/dtos/admin-report';

const reportId = '507f191e810c19729de860ea';

describe('admin report controller schemas', () => {
  it('normalizes list query parameters', () => {
    expect(
      adminReportListQuerySchema.parse({
        page: '2',
        limit: '25',
        status: 'resolved',
      }),
    ).toEqual({
      page: 2,
      limit: 25,
      status: 'resolved',
    });
  });

  it('defaults list query pagination and status', () => {
    expect(adminReportListQuerySchema.parse({})).toEqual({
      page: 1,
      limit: 20,
      status: 'all',
    });
  });

  it('validates route params and update body strictly', () => {
    expect(adminReportIdParamsSchema.parse({ id: reportId })).toEqual({ id: reportId });
    expect(adminReportIdParamsSchema.safeParse({ id: 'bad-id' }).success).toBe(false);
    expect(
      updateAdminReportRequestSchema.parse({
        status: 'dismissed',
        adminNotes: '  duplicate report  ',
      }),
    ).toEqual({ status: 'dismissed', adminNotes: 'duplicate report' });
    expect(
      updateAdminReportRequestSchema.safeParse({
        status: 'resolved',
        extra: true,
      }).success,
    ).toBe(false);
  });

  it('validates a complete question edit and its answer key', () => {
    expect(
      updateAdminReportedQuestionRequestSchema.parse({
        question: ' 2 + 2 = ? ',
        options: [' 3 ', ' 4 '],
        type: 'single',
        correctIndex: 1,
      }),
    ).toEqual({
      question: '2 + 2 = ?',
      options: ['3', '4'],
      type: 'single',
      correctIndex: 1,
    });
    expect(
      updateAdminReportedQuestionRequestSchema.safeParse({
        question: '2 + 2 = ?',
        options: ['3', '4'],
        type: 'multiple',
        correctIndexes: [],
      }).success,
    ).toBe(false);
  });
});
