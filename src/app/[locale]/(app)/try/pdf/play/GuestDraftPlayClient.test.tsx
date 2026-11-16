/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enGuest from '../../../../../../../messages/en/guestDraft.json';
import { ApiResponseError } from '@/lib/api/client';
import { readGuestDraftRound } from '@/features/guest-draft/lib/guest-draft-round';
import {
  addGuestDraftClaim,
  rememberClaimedGuestDraftQuiz,
} from '@/features/quiz/lib/guest-draft-claims';

const {
  fetchGuestDraftPlay,
  fetchGuestDraftProgress,
  submitGuestDraftAttempt,
  playerProps,
  replace,
  router,
  session,
} = vi.hoisted(() => {
  const replace = vi.fn();
  return {
    fetchGuestDraftPlay: vi.fn(),
    fetchGuestDraftProgress: vi.fn(),
    submitGuestDraftAttempt: vi.fn(),
    playerProps: { current: null as null | Record<string, unknown> },
    replace,
    router: { replace },
    session: { status: 'unauthenticated' },
  };
});

vi.mock('next-auth/react', () => ({ useSession: () => ({ data: null, status: session.status }) }));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  // Stable identity, like the real router: the load effect depends on it.
  useRouter: () => router,
}));
vi.mock('@/features/guest-draft/api/guest-draft-api', async (importActual) => ({
  ...(await importActual<typeof import('@/features/guest-draft/api/guest-draft-api')>()),
  fetchGuestDraftPlay,
  fetchGuestDraftProgress,
  submitGuestDraftAttempt,
}));
vi.mock('../../../quiz/[slug]/QuizPlayerClient', async () => {
  const { QuestionTotal } = await import('@/features/quiz/components/player/QuestionTotal');
  return {
    default: (
      props: Record<string, unknown> & {
        initialQuiz: { questions: unknown[] };
        guestDraft: { notice: ReactNode; moreQuestions?: unknown[] };
      },
    ) => {
      playerProps.current = props;
      const total =
        props.initialQuiz.questions.length + (props.guestDraft.moreQuestions?.length ?? 0);
      return (
        <div data-testid="player">
          {props.guestDraft.notice}
          <p data-testid="counter">
            Question 1 of <QuestionTotal count={total} />
          </p>
        </div>
      );
    },
  };
});

import { GuestDraftPlayClient } from './GuestDraftPlayClient';

const quiz = {
  id: 'guest-draft-play',
  slug: 'guest-draft-play',
  title: 'Cell biology',
  author: null,
  folder: null,
  visibility: 'public',
  questionCount: 1,
  createdAt: '2026-11-10T00:00:00.000Z',
  updatedAt: '2026-11-10T00:00:00.000Z',
  questions: [],
};

function renderClient(source?: 'text') {
  return render(
    <NextIntlClientProvider locale="en" messages={{ guestDraft: enGuest }}>
      <GuestDraftPlayClient {...(source ? { source } : {})} />
    </NextIntlClientProvider>,
  );
}

describe('GuestDraftPlayClient (RIN-1448)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState(null, '', '/');
    playerProps.current = null;
    session.status = 'unauthenticated';
  });

  it('shows the expired card when this browser holds no draft', async () => {
    renderClient();
    expect(await screen.findByRole('heading', { name: 'This quiz has expired' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Make it again' })).toHaveAttribute('href', '/try/pdf');
    expect(fetchGuestDraftPlay).not.toHaveBeenCalled();
    // The guest card keeps its single action (RIN-1485 AC2).
    expect(screen.queryByRole('link', { name: 'Go to my library' })).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('adds a library link to the expired card for a signed-in visitor (RIN-1485)', async () => {
    session.status = 'authenticated';
    renderClient();
    expect(await screen.findByRole('heading', { name: 'This quiz has expired' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Make it again' })).toHaveAttribute('href', '/try/pdf');
    expect(screen.getByRole('link', { name: 'Go to my library' })).toHaveAttribute(
      'href',
      '/my-quizzes',
    );
  });

  it('opens the claimed quiz in the signed-in player once the draft is claimed (RIN-1485)', async () => {
    rememberClaimedGuestDraftQuiz('fake-claimed-quiz');
    renderClient();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/quiz/fake-claimed-quiz'));
    expect(
      screen.queryByRole('heading', { name: 'This quiz has expired' }),
    ).not.toBeInTheDocument();
    expect(fetchGuestDraftPlay).not.toHaveBeenCalled();
  });

  it('opens the claimed quiz when the server no longer has the stored draft (RIN-1485)', async () => {
    addGuestDraftClaim({ token: 'fake-draft-token', createdAt: Date.now() });
    rememberClaimedGuestDraftQuiz('fake-claimed-quiz');
    fetchGuestDraftPlay.mockRejectedValue(
      new ApiResponseError({ message: 'gone', status: 404, payload: null }),
    );
    renderClient();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/quiz/fake-claimed-quiz'));
  });

  it('shows the expired card when the server no longer has the draft', async () => {
    addGuestDraftClaim({ token: 'fake-draft-token', createdAt: Date.now() });
    fetchGuestDraftPlay.mockRejectedValue(
      new ApiResponseError({ message: 'gone', status: 404, payload: null }),
    );
    renderClient();
    expect(await screen.findByRole('heading', { name: 'This quiz has expired' })).toBeVisible();
  });

  it('plays the newest draft with the 24 h notice and submits with its token', async () => {
    addGuestDraftClaim({ token: 'fake-draft-token', createdAt: Date.now() });
    fetchGuestDraftPlay.mockResolvedValue({ quiz, complete: true });
    submitGuestDraftAttempt.mockResolvedValue({ attemptId: 'attempt-1', score: 50 });
    renderClient();

    await screen.findByTestId('player');
    expect(fetchGuestDraftPlay).toHaveBeenCalledWith('fake-draft-token');
    const notice = screen.getByText(/Kept for 24 hours/);
    // Design review RIN-1480 [P2]: the strip has an edge on the page background.
    expect(notice).toHaveClass('border', 'border-orange-100');
    expect(screen.getByRole('link', { name: 'sign up' })).toHaveAttribute('href', '/register');
    expect(playerProps.current).toMatchObject({ initialQuiz: quiz, slug: 'guest-draft-play' });

    const guestDraft = playerProps.current?.['guestDraft'] as {
      submitAttempt: (input: object) => Promise<unknown>;
    };
    const input = { answers: [1], idempotencyKey: 'key', guestClaimToken: 'claim' };
    await guestDraft.submitAttempt(input);
    expect(submitGuestDraftAttempt).toHaveBeenCalledWith('fake-draft-token', input);
  });

  it('uses the text copy and sends "Make it again" to /try/text (RIN-1539)', async () => {
    renderClient('text');
    expect(await screen.findByText(/Make it again from your text/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Make it again' })).toHaveAttribute(
      'href',
      '/try/text',
    );
  });

  it('shows the text notice above question 1 of a text draft (RIN-1539)', async () => {
    addGuestDraftClaim({ token: 'fake-draft-token', createdAt: Date.now() });
    fetchGuestDraftPlay.mockResolvedValue({ quiz, complete: true });
    renderClient('text');
    await screen.findByTestId('player');
    expect(screen.getByText(/Quiz from your text/)).toBeVisible();
  });

  describe('a draft that opens on its first batch (RIN-1620)', () => {
    const fakeQuestion = (id: string) => ({
      id,
      question: `Fake question ${id}?`,
      options: ['A', 'B'],
      type: 'single',
    });
    const firstBatch = { ...quiz, questions: ['q1', 'q2'].map(fakeQuestion) };
    const fullDraft = { ...quiz, questions: ['q1', 'q2', 'q3', 'q4'].map(fakeQuestion) };
    const status = (questionCount: number, complete: boolean) => ({
      status: 'ready',
      percent: 100,
      questionCount,
      title: 'Cell biology',
      complete,
    });

    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      fetchGuestDraftPlay.mockReset();
      fetchGuestDraftProgress.mockReset();
      addGuestDraftClaim({ token: 'fake-draft-token', createdAt: Date.now() });
      fetchGuestDraftPlay.mockResolvedValueOnce({ quiz: firstBatch, complete: false });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows "of 2+" and the pending line, then appends the rest and stops polling', async () => {
      fetchGuestDraftProgress
        .mockResolvedValueOnce(status(2, false))
        .mockResolvedValueOnce(status(4, true));
      fetchGuestDraftPlay.mockResolvedValueOnce({ quiz: fullDraft, complete: true });
      renderClient();

      await screen.findByTestId('player');
      expect(screen.getByTestId('counter')).toHaveTextContent('Question 1 of 2+');
      const pending = screen.getByTestId('guest-draft-pending');
      expect(pending).toHaveTextContent('More questions are being made.');
      expect(pending).not.toHaveClass('invisible');

      await act(() => vi.advanceTimersByTimeAsync(2_000));
      // Still processing: no refetch of the questions.
      expect(fetchGuestDraftPlay).toHaveBeenCalledOnce();
      await act(() => vi.advanceTimersByTimeAsync(2_000));

      await waitFor(() =>
        expect(screen.getByTestId('counter')).toHaveTextContent('Question 1 of 4'),
      );
      expect(screen.getByTestId('counter')).not.toHaveTextContent('+');
      // The line keeps its space, unseen and unread, so the question below never moves.
      expect(screen.getByTestId('guest-draft-pending')).toHaveClass('invisible');
      expect(screen.getByTestId('guest-draft-pending')).toHaveAttribute('aria-hidden', 'true');
      expect(playerProps.current).toMatchObject({ initialQuiz: firstBatch });
      const guestDraft = playerProps.current?.['guestDraft'] as { moreQuestions: { id: string }[] };
      expect(guestDraft.moreQuestions.map((item) => item.id)).toEqual(['q3', 'q4']);

      await act(() => vi.advanceTimersByTimeAsync(10_000));
      expect(fetchGuestDraftProgress).toHaveBeenCalledTimes(2);
    });

    it('drops the "+" silently when the rest fails, and keeps the round', async () => {
      fetchGuestDraftProgress.mockResolvedValueOnce(status(2, true));
      fetchGuestDraftPlay.mockResolvedValueOnce({ quiz: firstBatch, complete: true });
      renderClient();

      await screen.findByTestId('player');
      await act(() => vi.advanceTimersByTimeAsync(2_000));

      await waitFor(() =>
        expect(screen.getByTestId('counter')).toHaveTextContent('Question 1 of 2'),
      );
      expect(screen.getByTestId('counter')).not.toHaveTextContent('+');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      const guestDraft = playerProps.current?.['guestDraft'] as { moreQuestions: unknown[] };
      expect(guestDraft.moreQuestions).toEqual([]);
    });

    it('stops polling when the draft is gone (404) and keeps the round', async () => {
      fetchGuestDraftProgress.mockRejectedValue(
        new ApiResponseError({ message: 'gone', status: 404, payload: null }),
      );
      renderClient();

      await screen.findByTestId('player');
      await act(() => vi.advanceTimersByTimeAsync(2_000));
      await waitFor(() =>
        expect(screen.getByTestId('counter')).toHaveTextContent('Question 1 of 2'),
      );
      expect(screen.getByTestId('counter')).not.toHaveTextContent('+');
      await act(() => vi.advanceTimersByTimeAsync(10_000));
      expect(fetchGuestDraftProgress).toHaveBeenCalledOnce();
    });

    it('remembers the round it submitted, from the first question, while more is pending', async () => {
      fetchGuestDraftProgress.mockResolvedValue(status(2, false));
      submitGuestDraftAttempt.mockResolvedValue({ attemptId: 'attempt-first', score: 50 });
      renderClient('text');
      await screen.findByTestId('player');

      const guestDraft = playerProps.current?.['guestDraft'] as {
        submitAttempt: (input: object) => Promise<unknown>;
      };
      const input = { answers: [1, 0], idempotencyKey: 'key', guestClaimToken: 'claim' };
      await guestDraft.submitAttempt(input);

      // No range for the first round: the server takes the first answers.length questions.
      expect(submitGuestDraftAttempt).toHaveBeenCalledWith('fake-draft-token', input);
      expect(readGuestDraftRound('attempt-first')).toEqual({
        from: 0,
        count: 2,
        pending: true,
        source: 'text',
      });
    });

    it('plays only the new questions after "Keep going" and submits their range', async () => {
      window.history.replaceState(null, '', '/try/pdf/play?from=2');
      fetchGuestDraftPlay.mockReset();
      fetchGuestDraftPlay.mockResolvedValueOnce({ quiz: fullDraft, complete: true });
      submitGuestDraftAttempt.mockResolvedValue({ attemptId: 'attempt-second', score: 100 });
      renderClient();
      await screen.findByTestId('player');

      const opened = playerProps.current?.['initialQuiz'] as { questions: { id: string }[] };
      expect(opened.questions.map((item) => item.id)).toEqual(['q3', 'q4']);
      expect(screen.getByTestId('counter')).toHaveTextContent('Question 1 of 2');

      const guestDraft = playerProps.current?.['guestDraft'] as {
        submitAttempt: (input: object) => Promise<unknown>;
      };
      const input = { answers: [0, 1], idempotencyKey: 'key-2', guestClaimToken: 'claim-2' };
      await guestDraft.submitAttempt(input);
      expect(submitGuestDraftAttempt).toHaveBeenCalledWith('fake-draft-token', {
        ...input,
        questionRange: { from: 2, count: 2 },
      });
      expect(readGuestDraftRound('attempt-second')).toMatchObject({ from: 2, count: 2 });
      window.history.replaceState(null, '', '/');
    });

    it('keeps polling through a failed check and stops on unmount', async () => {
      fetchGuestDraftProgress
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValue(status(2, false));
      const view = renderClient();

      await screen.findByTestId('player');
      await act(() => vi.advanceTimersByTimeAsync(2_000));
      await act(() => vi.advanceTimersByTimeAsync(2_000));
      expect(fetchGuestDraftProgress).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('counter')).toHaveTextContent('Question 1 of 2+');

      view.unmount();
      await act(() => vi.advanceTimersByTimeAsync(10_000));
      expect(fetchGuestDraftProgress).toHaveBeenCalledTimes(2);
    });
  });
});
