import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { fetchQuizMock } = vi.hoisted(() => ({ fetchQuizMock: vi.fn() }));
const translate = vi.hoisted(() => (key: string) => key);

vi.mock('next-intl', () => ({ useTranslations: () => translate, useLocale: () => 'en' }));
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'owner-1', role: 'user', emailVerified: true } } }),
}));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/lib/routing/useRequiredRouteParam', () => ({ useRequiredRouteParam: () => 'quiz-1' }));
vi.mock('@/lib/api/use-api-error', () => ({
  useApiErrorMessage: () => (_error: unknown, fallback: string) => fallback,
  useApiErrorToast: () => () => undefined,
}));
vi.mock('@/features/quiz/api/quiz-edit-api', () => ({
  fetchQuizEditViewModel: fetchQuizMock,
  updateQuizEditViewModel: vi.fn(),
}));
vi.mock('@/features/quiz/api/quiz-api', () => ({ deleteQuizById: vi.fn() }));
// Copy and Terms link are tested with real messages in PublicQuizNotice.test.tsx.
vi.mock('@/features/quiz/components/PublicQuizNotice', () => ({
  PublicQuizNotice: ({
    variant,
    showPremiumPointer,
  }: {
    variant: string;
    showPremiumPointer?: boolean;
  }) => (
    <p data-testid="public-quiz-notice" data-variant={variant}>
      {showPremiumPointer ? 'notice+pointer' : 'notice'}
    </p>
  ),
}));

import { EditQuizPage } from './EditQuizPage';

// RIN-1339 (spec RIN-1336 Part 1, AC 6): the edit page shows the short notice
// once, near the Premium choice, and adds no control.
describe('EditQuizPage public-quiz notice', () => {
  it('renders the short notice once, right above the Premium checkbox', async () => {
    fetchQuizMock.mockResolvedValue({
      id: 'quiz-1',
      title: 'Cell biology',
      slug: 'cell-biology',
      author: { id: 'owner-1' },
      folder: null,
      visibility: 'public',
      questionCount: 0,
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
      questions: [],
    });

    render(<EditQuizPage />);

    const premium = await screen.findByRole('checkbox', { name: /premiumQuiz/ });
    expect(screen.getAllByTestId('public-quiz-notice')).toHaveLength(1);
    const notice = screen.getByTestId('public-quiz-notice');
    expect(notice).toHaveAttribute('data-variant', 'short');
    expect(notice).toHaveTextContent(/^notice$/);
    expect(notice.compareDocumentPosition(premium) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  });
});
