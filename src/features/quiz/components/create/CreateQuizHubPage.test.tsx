/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiResponseError } from '@/lib/api/client';
import { createManualQuizDraft } from '@/lib/quiz/draftApi';
import { CreateQuizHubPage } from './CreateQuizHubPage';

vi.mock('next/image', () => ({
  default: ({
    priority: _priority,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => (
    // The test double preserves Next Image props without running its optimizer.
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img {...props} />
  ),
}));

const translate = (key: string) => key;
vi.mock('next-intl', () => ({
  useLocale: () => 'vi',
  useTranslations: () => translate,
}));

vi.mock('swr', () => ({
  default: () => ({
    data: [
      {
        id: 'draft-1',
        title: 'Quiz draft',
        sourceType: 'manual',
        status: 'drafting',
        questionCount: 2,
        updatedAt: '2026-07-28T00:00:00.000Z',
      },
    ],
    error: null,
    isLoading: false,
    mutate: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/quiz/draftApi', () => ({
  createManualQuizDraft: vi.fn(),
  deleteQuizDraft: vi.fn(),
  listQuizDrafts: vi.fn(),
}));

describe('CreateQuizHubPage', () => {
  it('renders concise creation choices with decorative illustrations', async () => {
    const { container } = render(<CreateQuizHubPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'createHubTitle' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'manualMethodTitle' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'pdfMethodTitle' })).toBeInTheDocument();
    expect(screen.queryByText('createHubDescription')).not.toBeInTheDocument();
    expect(screen.queryByText('yourDraftsDescription')).not.toBeInTheDocument();
    expect(
      container.querySelector('img[src="/images/create-quiz/manual-quiz-illustration.png"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('img[src="/images/create-quiz/pdf-quiz-illustration.png"]'),
    ).toBeInTheDocument();
    expect(container.querySelectorAll('.card.p-0')).toHaveLength(3);
    expect((await axe(container)).violations).toEqual([]);
  });

  // RIN-754: the toast used to carry the server's own message.
  it.each([
    {
      name: 'a coded 500',
      error: new ApiResponseError({
        message: 'E11000 duplicate key quiz_drafts',
        status: 500,
        payload: null,
        code: 'internal_error',
      }),
      description: 'errors.api.server',
    },
    {
      name: 'a plain Error',
      error: new Error('E11000 duplicate key quiz_drafts'),
      description: 'manualCreateFailed',
    },
  ])('shows localized copy when manual create fails with $name', async ({ error, description }) => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(createManualQuizDraft).mockRejectedValueOnce(error);
    render(<CreateQuizHubPage />);

    fireEvent.click(screen.getByRole('button', { name: 'startManual' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('error', { description }));
    expect(JSON.stringify(vi.mocked(toast.error).mock.calls)).not.toContain('E11000');
    vi.mocked(toast.error).mockClear();
  });
});
