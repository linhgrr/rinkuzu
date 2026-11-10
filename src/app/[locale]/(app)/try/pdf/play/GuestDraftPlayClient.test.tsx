/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import enGuest from '../../../../../../../messages/en/guestDraft.json';
import { ApiResponseError } from '@/lib/api/client';
import { addGuestDraftClaim } from '@/features/quiz/lib/guest-draft-claims';

const { fetchGuestDraftPlay, submitGuestDraftAttempt, playerProps } = vi.hoisted(() => ({
  fetchGuestDraftPlay: vi.fn(),
  submitGuestDraftAttempt: vi.fn(),
  playerProps: { current: null as null | Record<string, unknown> },
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/guest-draft/api/guest-draft-api', async (importActual) => ({
  ...(await importActual<typeof import('@/features/guest-draft/api/guest-draft-api')>()),
  fetchGuestDraftPlay,
  submitGuestDraftAttempt,
}));
vi.mock('../../../quiz/[slug]/QuizPlayerClient', () => ({
  default: (props: Record<string, unknown> & { guestDraft: { notice: ReactNode } }) => {
    playerProps.current = props;
    return <div data-testid="player">{props.guestDraft.notice}</div>;
  },
}));

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

function renderClient() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ guestDraft: enGuest }}>
      <GuestDraftPlayClient />
    </NextIntlClientProvider>,
  );
}

describe('GuestDraftPlayClient (RIN-1448)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    playerProps.current = null;
  });

  it('shows the expired card when this browser holds no draft', async () => {
    renderClient();
    expect(await screen.findByRole('heading', { name: 'This quiz has expired' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Make it again' })).toHaveAttribute('href', '/try/pdf');
    expect(fetchGuestDraftPlay).not.toHaveBeenCalled();
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
    fetchGuestDraftPlay.mockResolvedValue(quiz);
    submitGuestDraftAttempt.mockResolvedValue({ attemptId: 'attempt-1', score: 50 });
    renderClient();

    await screen.findByTestId('player');
    expect(fetchGuestDraftPlay).toHaveBeenCalledWith('fake-draft-token');
    expect(screen.getByText(/Kept for 24 hours/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'sign up' })).toHaveAttribute('href', '/register');
    expect(playerProps.current).toMatchObject({ initialQuiz: quiz, slug: 'guest-draft-play' });

    const guestDraft = playerProps.current?.['guestDraft'] as {
      submitAttempt: (input: object) => Promise<unknown>;
    };
    const input = { answers: [1], idempotencyKey: 'key', guestClaimToken: 'claim' };
    await guestDraft.submitAttempt(input);
    expect(submitGuestDraftAttempt).toHaveBeenCalledWith('fake-draft-token', input);
  });
});
