import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiResponseError } from '@/lib/api/client';
import type { AdminQuizListItemViewModel } from '@/features/admin/quizzes/types/admin-quizzes-view-model';

const { fetchListMock, setVisibilityMock, translate } = vi.hoisted(() => ({
  fetchListMock: vi.fn(),
  setVisibilityMock: vi.fn(),
  translate: (key: string) => key,
}));

// Stable `t`: the page lists it as a load-effect dependency.
vi.mock('next-intl', () => ({
  useTranslations: () => translate,
}));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/quiz/components/QuizPreviewModal', () => ({ QuizPreviewModal: () => null }));
vi.mock('@/features/admin/quizzes/api/admin-quizzes-api', () => ({
  fetchAdminQuizListViewModel: (...args: unknown[]) => fetchListMock(...args),
  fetchAdminQuizDetailViewModel: vi.fn(),
  deleteAdminQuiz: vi.fn(),
  setAdminQuizVisibility: (...args: unknown[]) => setVisibilityMock(...args),
}));

import { AdminQuizzesPageClient } from './AdminQuizzesPageClient';

function quiz(overrides: Partial<AdminQuizListItemViewModel> = {}): AdminQuizListItemViewModel {
  return {
    id: '507f191e810c19729de860ea',
    title: 'Fake Community Quiz',
    slug: 'fake-community-quiz',
    author: { id: '507f191e810c19729de860eb', displayName: 'Fake Author' },
    visibility: 'public',
    visibilityLabelKey: 'public',
    questionCount: 3,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function listOf(item: AdminQuizListItemViewModel) {
  return {
    quizzes: [item],
    pagination: {
      page: 1,
      limit: 12,
      total: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    },
  };
}

describe('AdminQuizzesPageClient visibility action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom has no modal dialog; the confirm step renders through one.
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });
  });

  it('makes a public quiz private only after confirmation, then updates the row', async () => {
    const user = userEvent.setup();
    fetchListMock.mockResolvedValue(listOf(quiz()));
    setVisibilityMock.mockResolvedValue({
      id: '507f191e810c19729de860ea',
      slug: 'fake-community-quiz',
      visibility: 'personal',
      changed: true,
    });

    render(<AdminQuizzesPageClient />);

    await user.click(await screen.findByRole('button', { name: 'quizMakePrivate' }));
    expect(setVisibilityMock).not.toHaveBeenCalled();

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('quizMakePrivateConfirm')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'quizMakePrivate' }));

    await waitFor(() =>
      expect(setVisibilityMock).toHaveBeenCalledWith('507f191e810c19729de860ea', 'personal'),
    );
    expect(await screen.findByRole('button', { name: 'quizMakePublic' })).toBeInTheDocument();
    expect(screen.getByText('personal')).toBeInTheDocument();
  });

  it('makes a private quiz public again from the same row', async () => {
    const user = userEvent.setup();
    fetchListMock.mockResolvedValue(
      listOf(quiz({ visibility: 'personal', visibilityLabelKey: 'personal' })),
    );
    setVisibilityMock.mockResolvedValue({
      id: '507f191e810c19729de860ea',
      slug: 'fake-community-quiz',
      visibility: 'public',
      changed: true,
    });

    render(<AdminQuizzesPageClient />);

    await user.click(await screen.findByRole('button', { name: 'quizMakePublic' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'quizMakePublic' }));

    await waitFor(() =>
      expect(setVisibilityMock).toHaveBeenCalledWith('507f191e810c19729de860ea', 'public'),
    );
    expect(await screen.findByRole('button', { name: 'quizMakePrivate' })).toBeInTheDocument();
  });

  it('keeps the row unchanged and shows localized copy, not server text, when refused', async () => {
    const user = userEvent.setup();
    fetchListMock.mockResolvedValue(
      listOf(quiz({ visibility: 'personal', visibilityLabelKey: 'personal' })),
    );
    setVisibilityMock.mockRejectedValue(
      new ApiResponseError({
        message: 'A quiz with a premium publication cannot be made public',
        status: 409,
        payload: null,
        code: 'conflict',
      }),
    );

    render(<AdminQuizzesPageClient />);

    await user.click(await screen.findByRole('button', { name: 'quizMakePublic' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'quizMakePublic' }));

    expect(
      await screen.findByText('errors.api.conflict · errors.api.codeLabel'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/premium publication/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'quizMakePublic' })).toBeInTheDocument();
  });
});
