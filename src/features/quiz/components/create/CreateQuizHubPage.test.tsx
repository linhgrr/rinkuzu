/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
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

vi.mock('next-intl', () => ({
  useLocale: () => 'vi',
  useTranslations: () => (key: string) => key,
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
});
