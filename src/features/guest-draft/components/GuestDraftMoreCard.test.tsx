/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { act, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enGuest from '../../../../messages/en/guestDraft.json';
import viGuest from '../../../../messages/vi/guestDraft.json';
import { rememberGuestDraftRound } from '@/features/guest-draft/lib/guest-draft-round';
import { addGuestDraftClaim } from '@/features/quiz/lib/guest-draft-claims';
import { ApiResponseError } from '@/lib/api/client';

const { fetchGuestDraftProgress } = vi.hoisted(() => ({ fetchGuestDraftProgress: vi.fn() }));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/guest-draft/api/guest-draft-api', async (importActual) => ({
  ...(await importActual<typeof import('@/features/guest-draft/api/guest-draft-api')>()),
  fetchGuestDraftProgress,
}));

import { GuestDraftMoreCard } from './GuestDraftMoreCard';

const status = (questionCount: number, complete: boolean, completion: string | null = null) => ({
  status: 'ready',
  percent: 100,
  questionCount,
  title: 'Cell biology',
  complete,
  completion,
});

function renderCard(locale: 'en' | 'vi' = 'en', attemptId: string | null = 'attempt-1') {
  const messages = { guestDraft: locale === 'en' ? enGuest : viGuest };
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <GuestDraftMoreCard attemptId={attemptId} />
    </NextIntlClientProvider>,
  );
}

describe('GuestDraftMoreCard (RIN-1620, results state 5)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchGuestDraftProgress.mockReset();
    localStorage.clear();
    sessionStorage.clear();
    addGuestDraftClaim({ token: 'fake-draft-token', createdAt: Date.now() });
    rememberGuestDraftRound('attempt-1', { from: 0, count: 5, pending: true, source: 'pdf' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows "more on the way" while the rest is made, then "Keep going" for the new ones', async () => {
    fetchGuestDraftProgress
      .mockResolvedValueOnce(status(5, false))
      .mockResolvedValueOnce(status(10, true, 'full'));
    renderCard();

    const card = await screen.findByRole('status');
    expect(card).toHaveTextContent('More questions are on the way');
    expect(card).toHaveTextContent("We're making the rest of your quiz.");
    expect(screen.queryByRole('link')).not.toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(2_000));
    expect(await screen.findByText('5 more questions are ready')).toBeVisible();
    // One card, swapped in place; it resumes after the first round's last question.
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Keep going' })).toHaveAttribute(
      'href',
      '/try/pdf/play?from=5',
    );

    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(fetchGuestDraftProgress).toHaveBeenCalledTimes(2);
  });

  it('sends "Keep going" of a text draft to the text player, in Vietnamese too', async () => {
    rememberGuestDraftRound('attempt-1', { from: 0, count: 5, pending: true, source: 'text' });
    fetchGuestDraftProgress.mockResolvedValue(status(8, true, 'full'));
    renderCard('vi');

    expect(await screen.findByText('Có thêm 3 câu hỏi')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Làm tiếp' })).toHaveAttribute(
      'href',
      '/try/text/play?from=5',
    );
  });

  it('shows one quiet line, no button, when the rest never came', async () => {
    fetchGuestDraftProgress.mockResolvedValue(status(5, true, 'first_batch_only'));
    renderCard();

    expect(
      await screen.findByText(
        "We couldn't make more questions this time. Your quiz is kept for 24 hours.",
      ),
    ).toBeVisible();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows the failed line when the draft failed after the first batch', async () => {
    fetchGuestDraftProgress.mockResolvedValue({ ...status(5, true), status: 'failed' });
    renderCard();
    expect(await screen.findByText(/We couldn't make more questions this time/)).toBeVisible();
  });

  it('keeps looking through a failed check, and stops once the rest is final', async () => {
    fetchGuestDraftProgress
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(status(7, true, 'full'));
    renderCard();

    await screen.findByText('More questions are on the way');
    await act(() => vi.advanceTimersByTimeAsync(2_000));
    expect(await screen.findByText('2 more questions are ready')).toBeVisible();
  });

  it('shows nothing when the draft is gone, for a full round, or for an unknown attempt', async () => {
    fetchGuestDraftProgress.mockRejectedValue(
      new ApiResponseError({ message: 'gone', status: 404, payload: null }),
    );
    const gone = renderCard();
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(gone.container).toBeEmptyDOMElement();
    gone.unmount();

    rememberGuestDraftRound('attempt-full', { from: 0, count: 10, pending: false, source: 'pdf' });
    const full = renderCard('en', 'attempt-full');
    expect(full.container).toBeEmptyDOMElement();
    full.unmount();

    expect(renderCard('en', 'attempt-unknown').container).toBeEmptyDOMElement();
    expect(renderCard('en', null).container).toBeEmptyDOMElement();
  });
});
