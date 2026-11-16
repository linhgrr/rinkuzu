/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PremiumPreviewResultCard } from './PremiumPreviewResultCard';

const { walletMock, unlockMock, captureMock } = vi.hoisted(() => ({
  walletMock: vi.fn(),
  unlockMock: vi.fn(),
  captureMock: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const translate = (key: string, values?: Record<string, unknown>) =>
  values ? `${key}:${JSON.stringify(values)}` : key;
vi.mock('next-intl', () => ({ useTranslations: () => translate }));

vi.mock('@/features/profile/api/credit-wallet-api', () => ({
  CREDIT_WALLET_KEY: '/api/credits',
  fetchCreditWallet: (...args: unknown[]) => walletMock(...args),
}));
vi.mock('@/features/quiz/api/premium-quiz-api', () => ({
  unlockPremiumQuiz: (...args: unknown[]) => unlockMock(...args),
}));
vi.mock('@/lib/analytics/client', () => ({
  captureAnalyticsEvent: (...args: unknown[]) => captureMock(...args),
}));

const PREVIEW = {
  fullQuestionCount: 20,
  quizId: 'quiz-1',
  freeQuiz: { slug: 'free-biology', title: 'Biology basics' },
};

function renderCard(preview: React.ComponentProps<typeof PremiumPreviewResultCard>['preview']) {
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <PremiumPreviewResultCard preview={preview} slug="premium-bio" playableCount={5} />
    </SWRConfig>,
  );
}

describe('PremiumPreviewResultCard (RIN-1725)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('states the preview size and the remaining count', async () => {
    walletMock.mockResolvedValue({ wallet: { balance: 2 } });
    renderCard(PREVIEW);

    expect(
      screen.getByRole('heading', { name: 'premiumPreviewResultTitle:{"shown":5,"total":20}' }),
    ).toBeInTheDocument();
    expect(screen.getByText('premiumPreviewResultText:{"remaining":15}')).toBeInTheDocument();
    await screen.findByText('premiumCreditBalance:{"count":2}');
  });

  it('at 0 credits disables the unlock and makes Upgrade the primary action', async () => {
    walletMock.mockResolvedValue({ wallet: { balance: 0 } });
    renderCard(PREVIEW);

    const unlock = await screen.findByRole('button', { name: 'premiumNotEnoughCredits' });
    expect(unlock).toBeDisabled();
    expect(screen.getByRole('link', { name: 'premiumUpgradeLink' })).toHaveClass('btn-primary');
  });

  it('at 1 credit or more enables the unlock as the primary action, Upgrade secondary', async () => {
    walletMock.mockResolvedValue({ wallet: { balance: 1 } });
    renderCard(PREVIEW);

    const unlock = await screen.findByRole('button', {
      name: 'premiumPreviewUnlockButton:{"remaining":15}',
    });
    expect(unlock).toBeEnabled();
    expect(screen.getByRole('link', { name: 'premiumUpgradeLink' })).toHaveClass('btn-secondary');
  });

  it('keeps the free quiz link available while the balance loads', () => {
    walletMock.mockReturnValue(new Promise(() => undefined));
    renderCard(PREVIEW);

    expect(
      screen.getByRole('link', { name: 'premiumPreviewFreeQuiz:{"subject":"Biology basics"}' }),
    ).toHaveAttribute('href', '/quiz/free-biology');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers the unlock and a retry when the balance fails to load', async () => {
    walletMock.mockRejectedValueOnce(new Error('offline'));
    walletMock.mockResolvedValue({ wallet: { balance: 4 } });
    renderCard(PREVIEW);

    expect(await screen.findByText(/premiumPreviewBalanceError/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'premiumPreviewUnlockButton:{"remaining":15}' }),
    ).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'premiumPreviewRetry' }));
    expect(await screen.findByText('premiumCreditBalance:{"count":4}')).toBeInTheDocument();
  });

  it('sends only the cta property for each click', async () => {
    walletMock.mockResolvedValue({ wallet: { balance: 1 } });
    unlockMock.mockResolvedValue({});
    renderCard(PREVIEW);
    await screen.findByText('premiumCreditBalance:{"count":1}');

    fireEvent.click(screen.getByRole('link', { name: 'premiumUpgradeLink' }));
    fireEvent.click(
      screen.getByRole('link', { name: 'premiumPreviewFreeQuiz:{"subject":"Biology basics"}' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'premiumPreviewUnlockButton:{"remaining":15}' }),
    );

    await waitFor(() => expect(captureMock).toHaveBeenCalledTimes(3));
    expect(captureMock.mock.calls).toEqual([
      ['premium_preview_cta_clicked', { cta: 'upgrade' }],
      ['premium_preview_cta_clicked', { cta: 'free_quiz' }],
      ['premium_preview_cta_clicked', { cta: 'unlock' }],
    ]);
  });

  it('after an unlock shows the full-quiz link and hides the other actions', async () => {
    walletMock.mockResolvedValue({ wallet: { balance: 1 } });
    unlockMock.mockResolvedValue({});
    renderCard(PREVIEW);

    fireEvent.click(
      await screen.findByRole('button', { name: 'premiumPreviewUnlockButton:{"remaining":15}' }),
    );

    expect(await screen.findByRole('link', { name: 'premiumPreviewPlayFull' })).toHaveAttribute(
      'href',
      '/quiz/premium-bio',
    );
    expect(unlockMock).toHaveBeenCalledWith('quiz-1');
    expect(screen.queryByRole('link', { name: 'premiumUpgradeLink' })).not.toBeInTheDocument();
  });

  it('shows the unlock error and re-enables the button when the unlock fails', async () => {
    walletMock.mockResolvedValue({ wallet: { balance: 1 } });
    unlockMock.mockRejectedValue(new Error('nope'));
    renderCard(PREVIEW);

    fireEvent.click(
      await screen.findByRole('button', { name: 'premiumPreviewUnlockButton:{"remaining":15}' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('premiumUnlockError');
    expect(
      screen.getByRole('button', { name: 'premiumPreviewUnlockButton:{"remaining":15}' }),
    ).toBeEnabled();
  });

  it('with nothing left to unlock offers Upgrade first and no unlock row', () => {
    walletMock.mockResolvedValue({ wallet: { balance: 3 } });
    renderCard({ fullQuestionCount: 5, quizId: 'quiz-1', freeQuiz: null });

    expect(
      screen.getByRole('heading', { name: 'premiumPreviewAllTitle:{"total":5}' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'premiumUpgradeLink' })).toHaveClass('btn-primary');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'premiumPreviewFreeQuizNoSubject' })).toHaveAttribute(
      'href',
      '/explore',
    );
  });
});
