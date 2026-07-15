import { describe, expect, it } from 'vitest';
import type { Report } from '@/entities/Report';
import { AdminReportDtoMapper } from '@/mappers/admin/AdminReportDtoMapper';

const report: Report = {
  id: '507f191e810c19729de860ea',
  quizId: '507f191e810c19729de860eb',
  quizTitle: 'Algebra Basics',
  quizSlug: 'algebra-basics',
  reporterEmail: 'learner@example.com',
  reporterName: 'Learner',
  content: 'Wrong answer',
  status: 'pending',
  createdAt: new Date('2026-07-01T00:00:00Z'),
  updatedAt: new Date('2026-07-01T01:00:00Z'),
};

describe('AdminReportDtoMapper', () => {
  it('maps report identity and dates to admin DTO', () => {
    expect(AdminReportDtoMapper.toDto(report)).toEqual({
      id: '507f191e810c19729de860ea',
      quizId: '507f191e810c19729de860eb',
      quizTitle: 'Algebra Basics',
      quizSlug: 'algebra-basics',
      reporterEmail: 'learner@example.com',
      reporterName: 'Learner',
      content: 'Wrong answer',
      status: 'pending',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T01:00:00.000Z',
    });
    expect(AdminReportDtoMapper.toDto(report)).not.toHaveProperty('resolvedAt');
    expect(AdminReportDtoMapper.toDto(report)).not.toHaveProperty('resolvedBy');
    expect(AdminReportDtoMapper.toDto(report)).not.toHaveProperty('adminNotes');
  });
});
