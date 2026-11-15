/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PremiumPreviewResultCard } from './PremiumPreviewResultCard';

const { captureMock, unlockMock, walletMock } = vi.hoisted(() => ({
  captureMock: vi.fn(),
  unlockMock: vi.fn(),
  walletMock: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const translate = (key: string, values?: Record<string, unknown>) =>
  values ? `${key}:${JSON.stringify(values)}` : key;
vi.mock('next-intl', () => ({ useTranslations: () => translate }));

vi.mock('@/lib/analytics/client', () => ({
  captureAnalyticsEvent: (...args: unknown[]) => captureMock(...args),
}));

vi.mock('@/features/profile/api/credit-wallet-api', () => ({
  CREDIT_WALLET_KEY: '/api/credits',
  fetchCreditWallet: (...args: unknown[]) => walletMock(...args),
}));

vi.mock('@/features/quiz/api/premium-quiz-api', () => ({
  unlockPremiumQuiz: (...args: unknown[]) => unlockMock(...args),
}));

const FREE_QUIZ = { slug: 'discrete-math', title: 'Discrete math' };
const UNLOCK_NAME = 'premiumPreviewUnlockButton:{"remaining":35}';

function renderCard(props: Partial<React.ComponentProps<typeof PremiumPreviewResultCard>> = {}) {
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <PremiumPreviewResultCard
        slug="premium-quiz"
        playedCount={5}
        fullQuestionCount={40}
        quizId="quiz-1"
        freeQuiz={FREE_QUIZ}
        {...props}
      />
    </SWRConfig>,
  );
}

describe('PremiumPreviewResultCard (RIN-1722)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unlockMock.mockResolvedValue({ granted: true, alreadyGranted: false, balance: 0 });
  });

  it('at 0 credits disables the unlock, makes Upgrade primary and keeps the free quiz', async () => {
    walletMock.mockResolvedValue({ wallet: { balance: 0 } });
    renderCard();

    const unlock = await screen.findByRole('button', { name: 'premiumNotEnoughCredits' });
    expect(unlock).toBeDisabled();
    expect(
      screen.getByText('premiumPreviewResultTitle:{"shown":5,"total":40}'),
    ).toBeInTheDocument();
    expect(screen.getByText('premiumPreviewResultText:{"remaining":35}')).toBeInTheDocument();
    expect(screen.getByText('premiumCreditBalance:{"count":0}')).toBeInTheDocument();
    const upgrade = screen.getByRole('link', { name: 'premiumUpgradeLink' });
    expect(upgrade).toHaveAttribute('href', '/subscription');
    expect(upgrade).toHaveClass('btn-primary');
    expect(screen.getByRole('link', { name: /premiumPreviewFreeQuiz/ })).toHaveAttribute(
      'href',
      '/quiz/discrete-math',
    );
  });

  it('with credit enables the unlock as primary and demotes Upgrade', async () => {
    walletMock.mockResolvedValue({ wallet: { balance: 2 } });
    renderCard();

    const unlock = await screen.findByRole('button', { name: UNLOCK_NAME });
    expect(unlock).toBeEnabled();
    expect(unlock).toHaveClass('btn-primary');
    expect(screen.getByRole('link', { name: 'premiumUpgradeLink' })).toHaveClass('btn-secondary');
  });

  it('holds the place while the balance loads, with the free quiz already usable', () => {
    walletMock.mockReturnValue(new Promise(() => undefined));
    renderCard();

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'premiumUpgradeLink' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /premiumPreviewFreeQuiz/ })).toBeInTheDocument();
  });

  it('keeps the unlock available when the balance fails to load, with a retry', async () => {
    walletMock.mockRejectedValueOnce(new Error('offline'));
    walletMock.mockResolvedValue({ wallet: { balance: 1 } });
    renderCard();

    expect(await screen.findByText('premiumPreviewBalanceError')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: UNLOCK_NAME })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'premiumPreviewRetry' }));
    expect(await screen.findByText('premiumCreditBalance:{"count":1}')).toBeInTheDocument();
  });

  it('unlocks, reports the click and points to the full quiz', async () => {
    walletMock.mockResolvedValue({ wallet: { balance: 1 } });
    renderCard();

    fireEvent.click(await screen.findByRole('button', { name: UNLOCK_NAME }));

    expect(await screen.findByText('premiumPreviewUnlockedTitle')).toBeInTheDocument();
    expect(unlockMock).toHaveBeenCalledWith('quiz-1');
    expect(captureMock).toHaveBeenCalledWith('premium_preview_cta_clicked', { cta: 'unlock' });
    expect(screen.getByRole('link', { name: 'premiumPreviewPlayFull' })).toHaveAttribute(
      'href',
      '/quiz/premium-quiz',
    );
    expect(screen.queryByRole('link', { name: 'premiumUpgradeLink' })).not.toBeInTheDocument();
  });

  it('shows the existing unlock error and re-enables the controls when the unlock fails', async () => {
    walletMock.mockResolvedValue({ wallet: { balance: 1 } });
    unlockMock.mockRejectedValueOnce(new Error('refused'));
    renderCard();

    fireEvent.click(await screen.findByRole('button', { name: UNLOCK_NAME }));

    expect(await screen.findByRole('alert')).toHaveTextContent('premiumUnlockError');
    await waitFor(() => expect(screen.getByRole('button', { name: UNLOCK_NAME })).toBeEnabled());
  });

  it('reports the upgrade and free-quiz clicks with only the cta', async () => {
    walletMock.mockResolvedValue({ wallet: { balance: 0 } });
    renderCard();

    fireEvent.click(await screen.findByRole('link', { name: 'premiumUpgradeLink' }));
    fireEvent.click(screen.getByRole('link', { name: /premiumPreviewFreeQuiz/ }));

    expect(captureMock).toHaveBeenNthCalledWith(1, 'premium_preview_cta_clicked', {
      cta: 'upgrade',
    });
    expect(captureMock).toHaveBeenNthCalledWith(2, 'premium_preview_cta_clicked', {
      cta: 'free_quiz',
    });
  });

  it('when the whole quiz was played drops the unlock and the balance read', () => {
    renderCard({ playedCount: 3, fullQuestionCount: 3, freeQuiz: null });

    expect(screen.getByText('premiumPreviewAllTitle:{"total":3}')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'premiumUpgradeLink' })).toHaveClass('btn-primary');
    expect(screen.getByRole('link', { name: 'premiumPreviewFreeQuizNoSubject' })).toHaveAttribute(
      'href',
      '/quizzes',
    );
    expect(walletMock).not.toHaveBeenCalled();
  });
});
