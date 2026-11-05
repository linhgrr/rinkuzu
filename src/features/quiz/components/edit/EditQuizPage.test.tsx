import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

const { fetchQuizMock, routeParam } = vi.hoisted(() => ({
  fetchQuizMock: vi.fn(),
  routeParam: { id: 'quiz-a' },
}));

const translate = vi.hoisted(() => (key: string) => key);
const describeError = vi.hoisted(() => (_error: unknown, fallback: string) => fallback);
vi.mock('next-intl', () => ({ useTranslations: () => translate, useLocale: () => 'en' }));
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: null }) }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/lib/routing/useRequiredRouteParam', () => ({
  useRequiredRouteParam: () => routeParam.id,
}));
vi.mock('@/lib/api/use-api-error', () => ({ useApiErrorMessage: () => describeError }));
vi.mock('@/features/quiz/api/quiz-edit-api', () => ({
  fetchQuizEditViewModel: fetchQuizMock,
  updateQuizEditViewModel: vi.fn(),
}));
vi.mock('@/features/quiz/api/quiz-api', () => ({ deleteQuizById: vi.fn() }));

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
