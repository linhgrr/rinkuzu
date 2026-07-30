/** @vitest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportedQuestionEditor } from './ReportedQuestionEditor';
import type { AdminReportViewModel } from '@/features/admin/reports/types/admin-reports-view-model';

const { fetchQuestionMock, updateQuestionMock } = vi.hoisted(() => ({
  fetchQuestionMock: vi.fn(),
  updateQuestionMock: vi.fn(),
}));

vi.mock('@/features/admin/reports/api/admin-reports-api', () => ({
  fetchAdminReportedQuestion: fetchQuestionMock,
  updateAdminReportedQuestion: updateQuestionMock,
}));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const report: AdminReportViewModel = {
  id: 'report-1',
  quizId: 'quiz-1',
  quizTitle: 'Algebra',
  quizSlug: 'algebra',
  questionId: 'question-1',
  reporterEmail: 'learner@example.com',
  reporterName: 'Learner',
  content: 'Wrong answer',
  status: 'pending',
  createdAt: '2026-07-01T00:00:00.000Z',
  createdAtLabel: 'Jul 1',
  updatedAt: '2026-07-01T00:00:00.000Z',
  updatedAtLabel: 'Jul 1',
  adminNotesInput: '',
};

const question = {
  id: 'question-1',
  index: 1,
  question: '2 + 2 = ?',
  options: ['3', '4'],
  type: 'single' as const,
  correctIndex: 1,
};

describe('ReportedQuestionEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchQuestionMock.mockResolvedValue(question);
    updateQuestionMock.mockImplementation(async ({ question: input }) => ({
      id: question.id,
      index: question.index,
      ...input,
    }));
  });

  it('loads the live question and saves an exact question-level edit', async () => {
    const user = userEvent.setup();
    render(<ReportedQuestionEditor report={report} />);

    expect(await screen.findByText('Current question 2')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Edit question/ }));
    const questionInput = screen.getByLabelText('Question');
    await user.clear(questionInput);
    await user.type(questionInput, '2 + 3 = ?');
    await user.click(screen.getByRole('button', { name: 'Save question' }));

    await waitFor(() =>
      expect(updateQuestionMock).toHaveBeenCalledWith({
        reportId: 'report-1',
        question: {
          question: '2 + 3 = ?',
          options: ['3', '4'],
          type: 'single',
          correctIndex: 1,
        },
      }),
    );
  });

  it('disables editing for legacy reports without a question id', () => {
    render(<ReportedQuestionEditor report={{ ...report, questionId: undefined }} />);

    expect(screen.getByText(/legacy quiz-level report/i)).toBeTruthy();
    expect(fetchQuestionMock).not.toHaveBeenCalled();
  });

  it('keeps the loading state when StrictMode aborts the first request', async () => {
    fetchQuestionMock
      .mockImplementationOnce(async () => question)
      .mockImplementationOnce(() => new Promise(() => {}));

    render(
      <StrictMode>
        <ReportedQuestionEditor report={report} />
      </StrictMode>,
    );

    await waitFor(() => expect(fetchQuestionMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('The reported question is unavailable.')).toBeNull();
  });
});
