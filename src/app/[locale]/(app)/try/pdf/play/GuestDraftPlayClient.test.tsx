/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import enGuest from '../../../../../../../messages/en/guestDraft.json';
import { ApiResponseError } from '@/lib/api/client';
import {
  addGuestDraftClaim,
  rememberClaimedGuestDraftQuiz,
} from '@/features/quiz/lib/guest-draft-claims';

const { fetchGuestDraftPlay, submitGuestDraftAttempt, playerProps, replace, session } = vi.hoisted(
  () => ({
    fetchGuestDraftPlay: vi.fn(),
    submitGuestDraftAttempt: vi.fn(),
    playerProps: { current: null as null | Record<string, unknown> },
    replace: vi.fn(),
    session: { status: 'unauthenticated' },
  }),
);

vi.mock('next-auth/react', () => ({ useSession: () => ({ data: null, status: session.status }) }));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ replace }),
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
    fetchGuestDraftPlay.mockResolvedValue(quiz);
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
    fetchGuestDraftPlay.mockResolvedValue(quiz);
    renderClient('text');
    await screen.findByTestId('player');
    expect(screen.getByText(/Quiz from your text/)).toBeVisible();
  });
});
