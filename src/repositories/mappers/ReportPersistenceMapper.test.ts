import { describe, expect, it } from 'vitest';
import { ReportPersistenceMapper } from '@/repositories/mappers/ReportPersistenceMapper';
import type { ReportPersistenceRecord } from '@/repositories/types/ReportPersistence';

const record: ReportPersistenceRecord = {
  _id: 'report-1',
  quizId: 'quiz-1',
  quizTitle: 'Algebra',
  quizSlug: 'algebra',
  reporterEmail: 'learner@example.com',
  reporterName: 'Learner',
  content: 'Incorrect answer',
  status: 'pending',
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T01:00:00.000Z'),
};

describe('ReportPersistenceMapper', () => {
  it('normalizes persistence identity and timestamps', () => {
    const entity = ReportPersistenceMapper.toEntity(record);
    expect(entity).toMatchObject({
      id: 'report-1',
      quizId: 'quiz-1',
      status: 'pending',
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-01T01:00:00.000Z'),
    });
    expect(entity).not.toHaveProperty('resolvedAt');
    expect(entity).not.toHaveProperty('resolvedBy');
    expect(entity).not.toHaveProperty('adminNotes');
  });

  it('rejects a record without persistence identity', () => {
    expect(() => ReportPersistenceMapper.toEntity({ ...record, _id: '' })).toThrow(
      'report._id is required',
    );
  });
});
