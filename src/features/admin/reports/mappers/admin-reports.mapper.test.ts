import { describe, expect, it } from 'vitest';
import { toAdminReportViewModels } from '@/features/admin/reports/mappers/admin-reports.mapper';

describe('toAdminReportViewModels', () => {
  it('maps report DTO to display-safe view model', () => {
    const [result] = toAdminReportViewModels([
      {
        id: 'report-1',
        quizId: 'quiz-1',
        quizTitle: 'Algebra',
        quizSlug: 'algebra',
        questionId: 'question-1',
        questionSnapshot: {
          id: 'question-1',
          index: 2,
          question: '2 + 2 = ?',
          options: ['3', '4'],
          type: 'single',
          correctIndex: 1,
        },
        reporterEmail: 'learner@example.com',
        reporterName: 'Learner',
        content: 'Wrong answer',
        status: 'pending',
        createdAt: '2026-07-02T00:00:00.000Z',
        updatedAt: '2026-07-02T01:00:00.000Z',
      },
    ]);

    expect(result).toMatchObject({
      id: 'report-1',
      quizId: 'quiz-1',
      status: 'pending',
      questionId: 'question-1',
      questionSnapshot: expect.objectContaining({ index: 2, correctIndex: 1 }),
      adminNotesInput: '',
    });
    expect(result?.createdAtLabel).not.toBe('—');
    expect(result?.updatedAtLabel).not.toBe('—');
    expect(result?.resolvedAtLabel).toBeUndefined();
    expect(result).not.toHaveProperty('resolvedAt');
    expect(result).not.toHaveProperty('resolvedBy');
    expect(result).not.toHaveProperty('adminNotes');
  });
});
