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
  hideAdminReportedQuiz,
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

  it('lists reports with optional status and reason filters and abort signal', async () => {
    const signal = new AbortController().signal;
    fetchApiDataMock.mockResolvedValue({ reports: [reportDto], pendingIndexHoldCount: 3 });

    await expect(
      fetchAdminReportViewModels({ status: 'all', reason: 'all' }, signal),
    ).resolves.toEqual({
      reports: [
        expect.objectContaining({ id: 'report-1', status: 'pending', adminNotesInput: '' }),
      ],
      pendingIndexHoldCount: 3,
    });
    expect(fetchApiDataMock).toHaveBeenCalledWith('/api/admin/reports?', { signal });

    fetchApiDataMock.mockResolvedValueOnce({ reports: [], pendingIndexHoldCount: 0 });
    await fetchAdminReportViewModels({ status: 'resolved', reason: 'copyright' });
    expect(fetchApiDataMock).toHaveBeenLastCalledWith(
      '/api/admin/reports?status=resolved&reason=copyright',
      {},
    );
  });

  it('maps reason and source of quiz-page reports (RIN-1344)', async () => {
    fetchApiDataMock.mockResolvedValue({
      reports: [{ ...reportDto, reason: 'personal_data', source: 'quiz_page' }],
      pendingIndexHoldCount: 1,
    });
    const list = await fetchAdminReportViewModels({ status: 'all', reason: 'all' });
    expect(list.reports[0]).toMatchObject({ reason: 'personal_data', source: 'quiz_page' });
  });

  it('hides the reported quiz with optional admin notes (RIN-1344)', async () => {
    fetchApiDataMock.mockResolvedValue({ message: 'ok' });
    await hideAdminReportedQuiz('report-1', 'Copyrighted textbook');
    expect(fetchApiDataMock).toHaveBeenCalledWith('/api/admin/reports/report-1/hide-quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminNotes: 'Copyrighted textbook' }),
    });

    await hideAdminReportedQuiz('report-1', '');
    expect(fetchApiDataMock).toHaveBeenLastCalledWith(
      '/api/admin/reports/report-1/hide-quiz',
      expect.objectContaining({ body: '{}' }),
    );
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
