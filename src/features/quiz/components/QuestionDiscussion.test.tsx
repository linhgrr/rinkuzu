/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiResponseError } from '@/lib/api/client';
import { QuestionDiscussion } from './QuestionDiscussion';

const { fetchDiscussionsMock, addCommentMock, signedIn } = vi.hoisted(() => ({
  fetchDiscussionsMock: vi.fn(),
  addCommentMock: vi.fn(),
  signedIn: { data: { user: { email: 'learner@example.test' } }, status: 'authenticated' },
}));

vi.mock('next-auth/react', () => ({ useSession: () => signedIn }));
vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

// Stable identity, like next-intl's memoized `t`.
const translate = (key: string) => key;
vi.mock('next-intl', () => ({ useTranslations: () => translate, useLocale: () => 'en' }));

vi.mock('@/features/quiz/api/quiz-interaction-api', () => ({
  fetchQuizDiscussionViewModels: (...args: unknown[]) => fetchDiscussionsMock(...args),
  addQuizDiscussionCommentViewModel: (...args: unknown[]) => addCommentMock(...args),
}));

function renderDiscussion() {
  return render(
    <QuestionDiscussion
      quizSlug="algebra"
      questionIndex={0}
      isCollapsed={false}
      onToggleCollapse={() => undefined}
    />,
  );
}

describe('QuestionDiscussion errors (RIN-753)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchDiscussionsMock.mockResolvedValue([]);
  });

  it('shows localized copy when the comments fail to load, never the server text', async () => {
    fetchDiscussionsMock.mockRejectedValueOnce(
      new ApiResponseError({ message: 'discussions shard down', status: 503, payload: {} }),
    );

    renderDiscussion();

    expect(await screen.findByRole('alert')).toHaveTextContent('errors.api.unavailable');
    expect(screen.queryByText(/shard down/)).not.toBeInTheDocument();
  });

  it('shows the rate-limit copy inline when posting is throttled', async () => {
    addCommentMock.mockRejectedValueOnce(
      new ApiResponseError({
        message: 'Too many comments from 10.0.0.1',
        status: 429,
        payload: {},
      }),
    );

    renderDiscussion();
    fireEvent.change(await screen.findByPlaceholderText('sharePlaceholder'), {
      target: { value: 'Is B right?' },
    });
    fireEvent.submit(
      screen.getByPlaceholderText('sharePlaceholder').closest('form') as HTMLElement,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('errors.api.rateLimited');
    expect(screen.queryByText(/10\.0\.0\.1/)).not.toBeInTheDocument();
  });
});

describe('QuestionDiscussion dates (RIN-1265)', () => {
  it('formats comment dates in the active locale (en), not vi-VN', async () => {
    fetchDiscussionsMock.mockResolvedValueOnce([
      {
        questionIndex: 0,
        comments: [
          {
            id: 'c1',
            author: { id: null, name: 'Fake Learner' },
            content: 'Fake comment',
            createdAt: '2026-07-02T00:00:00.000Z',
          },
        ],
      },
    ]);

    renderDiscussion();

    expect(await screen.findByText('Fake comment')).toBeInTheDocument();
    // en-US month-first with AM/PM; vi-VN would render "07:00 02/07/2026".
    expect(screen.getByText('07/02/2026, 07:00 AM')).toBeInTheDocument();
  });
});
