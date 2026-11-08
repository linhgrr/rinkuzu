import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

const { fetchQuizMock, updateQuizMock, routeParam, sessionState } = vi.hoisted(() => ({
  fetchQuizMock: vi.fn(),
  updateQuizMock: vi.fn(),
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
  updateQuizEditViewModel: updateQuizMock,
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

describe('EditQuizPage visibility control (RIN-1275)', () => {
  const owner = { user: { id: 'owner-1', role: 'user', emailVerified: true } };
  const loadQuiz = (visibility: 'public' | 'personal') => {
    const quiz = {
      id: 'quiz-v',
      title: 'Cell biology',
      slug: 'cell-biology',
      author: { id: 'owner-1' },
      folder: null,
      visibility,
      questionCount: 1,
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
      questions: [
        {
          id: 'q1',
          editorId: 'q1',
          question: 'What is a cell?',
          options: ['A unit of life', 'A rock'],
          type: 'single',
          correctIndex: 0,
        },
      ],
    };
    routeParam.id = 'quiz-v';
    sessionState.data = owner;
    fetchQuizMock.mockResolvedValue(quiz);
    updateQuizMock.mockReset();
    return quiz;
  };
  const visibilityGroup = () => screen.findByRole('group', { name: 'visibilityLabel' });
  const save = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('button', { name: /saveChanges/ }));

  it('preselects the saved visibility and does not send it when unchanged', async () => {
    const user = userEvent.setup();
    const quiz = loadQuiz('public');
    updateQuizMock.mockResolvedValue(quiz);
    render(<EditQuizPage />);

    const group = await visibilityGroup();
    expect(within(group).getByRole('button', { name: 'visibilityPublic' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(group).toHaveAccessibleDescription('visibilityPublicHelper');

    await save(user);
    expect(updateQuizMock).toHaveBeenCalledTimes(1);
    expect(updateQuizMock.mock.calls[0]?.[1]).not.toHaveProperty('visibility');
  });

  it('sends the new visibility when the owner changes it', async () => {
    const user = userEvent.setup();
    const quiz = loadQuiz('personal');
    updateQuizMock.mockResolvedValue({ ...quiz, visibility: 'public' });
    render(<EditQuizPage />);

    const group = await visibilityGroup();
    await user.click(within(group).getByRole('button', { name: 'visibilityPublic' }));
    await save(user);

    expect(updateQuizMock.mock.calls[0]?.[1]).toMatchObject({ visibility: 'public' });
  });

  it('locks to Private while Premium is ticked and restores the choice when unticked', async () => {
    const user = userEvent.setup();
    loadQuiz('public');
    render(<EditQuizPage />);

    const group = await visibilityGroup();
    const premium = screen.getByRole('checkbox', { name: /premiumQuiz/ });
    await user.click(premium);
    expect(within(group).getByRole('button', { name: 'visibilityPrivate' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(group).getByRole('button', { name: 'visibilityPublic' })).toBeDisabled();
    expect(group).toHaveAccessibleDescription('visibilityPremiumHelper');

    await user.click(premium);
    expect(within(group).getByRole('button', { name: 'visibilityPublic' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('on a 409 returns to Private, focuses it and shows the inline alert', async () => {
    const user = userEvent.setup();
    loadQuiz('personal');
    updateQuizMock.mockRejectedValue(
      Object.assign(new Error('conflict'), { status: 409, code: 'conflict' }),
    );
    render(<EditQuizPage />);

    const group = await visibilityGroup();
    await user.click(within(group).getByRole('button', { name: 'visibilityPublic' }));
    await save(user);

    const privateOption = within(group).getByRole('button', { name: 'visibilityPrivate' });
    expect(await screen.findByRole('alert')).toHaveTextContent('visibilityPremiumConflict');
    expect(privateOption).toHaveAttribute('aria-pressed', 'true');
    expect(privateOption).toHaveFocus();
    expect(screen.queryByText('updateFailed')).not.toBeInTheDocument();

    await user.click(within(group).getByRole('button', { name: 'visibilityPublic' }));
    expect(screen.queryByText('visibilityPremiumConflict')).not.toBeInTheDocument();
  });

  it('on a network error keeps the choice and shows the form banner', async () => {
    const user = userEvent.setup();
    loadQuiz('personal');
    updateQuizMock.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<EditQuizPage />);

    const group = await visibilityGroup();
    await user.click(within(group).getByRole('button', { name: 'visibilityPublic' }));
    await save(user);

    expect(await screen.findByText('updateFailed')).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'visibilityPublic' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByText('visibilityPremiumConflict')).not.toBeInTheDocument();
  });
});
