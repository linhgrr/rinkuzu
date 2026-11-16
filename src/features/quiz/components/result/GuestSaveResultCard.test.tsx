/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GUEST_CLAIMS_STORAGE_KEY,
  addGuestClaim,
  readGuestClaims,
} from '@/features/quiz/lib/guest-claims';
import { GuestSaveResultCard } from './GuestSaveResultCard';

const { captureMock, signInMock } = vi.hoisted(() => ({
  captureMock: vi.fn(),
  signInMock: vi.fn(),
}));

vi.mock('next-auth/react', () => ({ signIn: (...args: unknown[]) => signInMock(...args) }));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { count?: number }) =>
    values?.count === undefined ? key : `${key}:${values.count}`,
  useLocale: () => 'en',
}));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('@/lib/analytics/client', () => ({
  captureAnalyticsEvent: (...args: unknown[]) => captureMock(...args),
}));

const FAKE_TOKEN = 'B'.repeat(43);
const RESULT_PATH = '/quiz/demo/result?attemptId=attempt-1&score=60';

function storeClaim() {
  addGuestClaim({
    attemptId: 'attempt-1',
    token: FAKE_TOKEN,
    quizSlug: 'demo',
    takenAt: Date.now(),
  });
}

describe('GuestSaveResultCard review offer (RIN-1712)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('leads with the 2-day review offer for the review variant with wrong answers', () => {
    render(
      <GuestSaveResultCard
        resultPath={RESULT_PATH}
        variant="review"
        wrongCount={3}
        entry="blog"
        attemptId="attempt-1"
      />,
    );

    expect(screen.getByRole('region', { name: 'guestReviewOfferTitle:3' })).toHaveTextContent(
      'guestReviewOfferBody',
    );
    expect(screen.getByRole('button', { name: 'guestReviewOfferGoogle' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'guestSaveSignInEmail' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'guestSaveCreateAccount' })).toBeInTheDocument();
  });

  it.each([
    ['review with 0 wrong', { variant: 'review', wrongCount: 0 }],
    ['review without a count', { variant: 'review' }],
    ['scoreOnly', { variant: 'scoreOnly', wrongCount: 4 }],
    ['draft', { variant: 'draft', wrongCount: 4 }],
  ] as const)('keeps the old copy and sends no offer events for %s', (_label, props) => {
    render(<GuestSaveResultCard resultPath={RESULT_PATH} attemptId="attempt-1" {...props} />);

    expect(screen.queryByText('guestReviewOfferBody')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'guestReviewOfferGoogle' })).toBeNull();
    expect(captureMock).not.toHaveBeenCalled();
  });

  it('reports the offer once per mount with only the wrong count and the entry', () => {
    const { rerender } = render(
      <GuestSaveResultCard
        resultPath={RESULT_PATH}
        variant="review"
        wrongCount={2}
        entry="hub"
        attemptId="attempt-1"
      />,
    );
    rerender(
      <GuestSaveResultCard
        resultPath={RESULT_PATH}
        variant="review"
        wrongCount={2}
        entry="hub"
        attemptId="attempt-1"
      />,
    );

    expect(captureMock).toHaveBeenCalledTimes(1);
    expect(captureMock).toHaveBeenCalledWith('guest_review_offer_shown', {
      count_wrong: 2,
      entry: 'hub',
    });
  });

  it('marks the stored claim and reports the click only for the Google offer button', () => {
    storeClaim();
    render(
      <GuestSaveResultCard
        resultPath={RESULT_PATH}
        variant="review"
        wrongCount={2}
        attemptId="attempt-1"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'guestReviewOfferGoogle' }));

    expect(readGuestClaims()[0]).toMatchObject({ attemptId: 'attempt-1', reviewOptIn: true });
    expect(captureMock).toHaveBeenCalledWith('guest_review_offer_clicked', {
      count_wrong: 2,
      entry: 'direct',
    });
    expect(signInMock).toHaveBeenCalledWith('google', expect.any(Object));
  });

  it('marks nothing when the email links are used', () => {
    storeClaim();
    render(
      <GuestSaveResultCard
        resultPath={RESULT_PATH}
        variant="review"
        wrongCount={2}
        attemptId="attempt-1"
      />,
    );

    fireEvent.click(screen.getByRole('link', { name: 'guestSaveSignInEmail' }));
    fireEvent.click(screen.getByRole('link', { name: 'guestSaveCreateAccount' }));

    expect(window.localStorage.getItem(GUEST_CLAIMS_STORAGE_KEY)).not.toContain('reviewOptIn');
    expect(captureMock).not.toHaveBeenCalledWith('guest_review_offer_clicked', expect.anything());
  });

  it('does not mark a claim when the plain save card Google button is used', () => {
    storeClaim();
    render(
      <GuestSaveResultCard
        resultPath={RESULT_PATH}
        variant="scoreOnly"
        wrongCount={5}
        attemptId="attempt-1"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'guestSaveWithGoogle' }));

    expect(window.localStorage.getItem(GUEST_CLAIMS_STORAGE_KEY)).not.toContain('reviewOptIn');
  });
});
