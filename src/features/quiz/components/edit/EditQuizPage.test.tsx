import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

const { fetchQuizMock, routeParam, sessionState } = vi.hoisted(() => ({
  fetchQuizMock: vi.fn(),
  routeParam: { id: 'quiz-a' },
  sessionState: { data: null as unknown },
}));

const translate = vi.hoisted(() => (key: string) => key);
const describeError = vi.hoisted(() => (_error: unknown, fallback: string) => fallback);
vi.mock('next-intl', () => ({ useTranslations: () => translate, useLocale: () => 'en' }));
vi.mock('next-auth/react', () => ({ useSession: () => sessionState }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/lib/routing/useRequiredRouteParam', () => ({
  useRequiredRouteParam: () => routeParam.id,
}));
vi.mock('@/lib/api/use-api-error', () => ({
  useApiErrorMessage: () => describeError,
  useApiErrorToast: () => () => undefined,
}));
vi.mock('@/features/quiz/api/quiz-edit-api', () => ({
  fetchQuizEditViewModel: fetchQuizMock,
  updateQuizEditViewModel: vi.fn(),
}));
vi.mock('@/features/quiz/api/quiz-api', () => ({ deleteQuizById: vi.fn() }));
// RIN-1339: the notice's copy is tested with real messages in PublicQuizNotice.test.tsx.
vi.mock('@/features/quiz/components/PublicQuizNotice', () => ({ PublicQuizNotice: () => null }));

import { EditQuizPage } from './EditQuizPage';

describe('EditQuizPage load', () => {
  it('ignores a superseded quiz load that resolves after the current one', async () => {
    let resolveStale: (quiz: unknown) => void = () => undefined;
    fetchQuizMock.mockImplementation((id: string) =>
      id === 'quiz-a'
        ? new Promise((resolve) => {
            resolveStale = resolve;
          })
        : Promise.reject(new Error('not found')),
    );

    const view = render(<EditQuizPage />);
    routeParam.id = 'quiz-b';
    view.rerender(<EditQuizPage />);
    expect(await screen.findByText('loadFailed')).toBeInTheDocument();

    await act(async () => {
      resolveStale({ id: 'quiz-a', title: 'Stale quiz' });
    });

    // The late answer for quiz-a must not replace quiz-b's state.
    expect(screen.getByText('loadFailed')).toBeInTheDocument();
  });
});

describe('EditQuizPage Premium checkbox (RIN-1271)', () => {
  it('starts unticked on a private quiz, so a plain save never submits it to Premium', async () => {
    routeParam.id = 'quiz-private';
    sessionState.data = { user: { id: 'owner-1', role: 'user', emailVerified: true } };
    fetchQuizMock.mockResolvedValue({
      id: 'quiz-private',
      title: 'Cell biology',
      slug: 'cell-biology',
      author: { id: 'owner-1' },
      folder: null,
      visibility: 'personal',
      questionCount: 0,
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
      questions: [],
    });

    render(<EditQuizPage />);

    const premium = await screen.findByRole('checkbox', { name: /premiumQuiz/ });
    expect(premium).not.toBeChecked();
    sessionState.data = null;
  });
});
