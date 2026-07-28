/** @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReportQuiz from '@/features/quiz/components/ReportQuiz';

const { reportQuizMock } = vi.hoisted(() => ({
  reportQuizMock: vi.fn(),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'user-1' } } }),
}));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, number>) =>
    key === 'questionNumber' ? `Question ${values?.['number'] ?? ''}` : key,
}));
vi.mock('@/features/quiz/api/quiz-interaction-api', () => ({
  reportQuizViewModel: reportQuizMock,
}));
vi.mock('@/components/ui/Modal', () => ({
  Modal: ({ isOpen, children, title }: { isOpen: boolean; children: ReactNode; title: string }) =>
    isOpen ? <div aria-label={title}>{children}</div> : null,
}));

describe('ReportQuiz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reportQuizMock.mockResolvedValue({ reportId: 'report-1' });
  });

  it('submits the stable id of the question shown to the learner', async () => {
    render(
      <ReportQuiz
        quizSlug="algebra"
        quizTitle="Algebra"
        questionId="507f1f77bcf86cd799439011"
        questionNumber={3}
        questionText="2 + 2 = ?"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'reportQuestion' }));
    expect(screen.getByText('Question 3')).toBeTruthy();
    expect(screen.getByText('2 + 2 = ?')).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/reportDetails/), {
      target: { value: 'The marked answer is wrong' },
    });
    const submitButton = screen.getByRole('button', { name: 'submitReport' });
    await waitFor(() => expect((submitButton as HTMLButtonElement).disabled).toBe(false));
    const form = submitButton.closest('form');
    expect(form).not.toBeNull();
    if (form) {
      fireEvent.submit(form);
    }

    await waitFor(() =>
      expect(reportQuizMock).toHaveBeenCalledWith(
        'algebra',
        '507f1f77bcf86cd799439011',
        'The marked answer is wrong',
      ),
    );
  });
});
