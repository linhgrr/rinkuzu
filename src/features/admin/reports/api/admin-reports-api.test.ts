import { afterEach, describe, expect, it, vi } from 'vitest';

const { fetchApiDataMock } = vi.hoisted(() => ({
  fetchApiDataMock: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  fetchApiData: fetchApiDataMock,
}));

import {
  deleteAdminReport,
  fetchAdminReportViewModels,
  fetchAdminReportedQuestion,
  updateAdminReportedQuestion,
  updateAdminReportStatus,
} from '@/features/admin/reports/api/admin-reports-api';

const reportDto = {
  id: 'report-1',
  quizId: 'quiz-1',
  quizTitle: 'Algebra',
  quizSlug: 'algebra',
  reporterEmail: 'learner@example.com',
  reporterName: 'Learner',
  content: 'Wrong answer',
  status: 'pending' as const,
  createdAt: '2026-07-02T00:00:00.000Z',
  updatedAt: '2026-07-02T01:00:00.000Z',
};

describe('admin-reports-api', () => {
  afterEach(() => {
    fetchApiDataMock.mockReset();
  });

  it('lists reports with optional status filter and abort signal', async () => {
    const signal = new AbortController().signal;
    fetchApiDataMock.mockResolvedValue({ reports: [reportDto] });

    await expect(fetchAdminReportViewModels('all', signal)).resolves.toEqual([
      expect.objectContaining({ id: 'report-1', status: 'pending', adminNotesInput: '' }),
    ]);
    expect(fetchApiDataMock).toHaveBeenCalledWith('/api/admin/reports?', { signal });

    fetchApiDataMock.mockResolvedValueOnce({ reports: [] });
    await fetchAdminReportViewModels('resolved');
    expect(fetchApiDataMock).toHaveBeenLastCalledWith('/api/admin/reports?status=resolved', {});
  });

  it('updates report status and deletes reports by id', async () => {
    fetchApiDataMock.mockResolvedValue({ message: 'updated' });

    await expect(
      updateAdminReportStatus({
        reportId: 'report-1',
        status: 'resolved',
        adminNotes: 'Fixed',
      }),
    ).resolves.toEqual({ message: 'updated' });
    expect(fetchApiDataMock).toHaveBeenCalledWith('/api/admin/reports/report-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'resolved',
        adminNotes: 'Fixed',
      }),
    });

    fetchApiDataMock.mockResolvedValueOnce({ deleted: true });
    await expect(deleteAdminReport('report-1')).resolves.toEqual({ deleted: true });
    expect(fetchApiDataMock).toHaveBeenLastCalledWith('/api/admin/reports/report-1', {
      method: 'DELETE',
    });
  });

  it('loads and updates the question linked to a report', async () => {
    const question = {
      id: 'question-1',
      index: 0,
      question: '2 + 2 = ?',
      options: ['3', '4'],
      type: 'single' as const,
      correctIndex: 1,
    };
    const signal = new AbortController().signal;
    fetchApiDataMock.mockResolvedValue(question);

    await expect(fetchAdminReportedQuestion('report-1', signal)).resolves.toEqual(question);
    expect(fetchApiDataMock).toHaveBeenCalledWith('/api/admin/reports/report-1/question', {
      signal,
    });

    const { id: _id, index: _index, ...input } = question;
    await expect(
      updateAdminReportedQuestion({ reportId: 'report-1', question: input }),
    ).resolves.toEqual(question);
    expect(fetchApiDataMock).toHaveBeenLastCalledWith('/api/admin/reports/report-1/question', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  });
});
