/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PremiumUnlockCard } from './PremiumUnlockCard';

const { walletMock } = vi.hoisted(() => ({ walletMock: vi.fn() }));

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

function renderCard(props: Partial<React.ComponentProps<typeof PremiumUnlockCard>> = {}) {
  const onUnlock = props.onUnlock ?? vi.fn().mockResolvedValue(undefined);
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <PremiumUnlockCard
        title="Premium quiz"
        description="premiumUnlockDescription"
        loading={false}
        error=""
        {...props}
        onUnlock={onUnlock}
      />
    </SWRConfig>,
  );
  return { onUnlock };
}

describe('PremiumUnlockCard (RIN-1014)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('labels the unlock button, shows the balance and refreshes it after unlocking', async () => {
    walletMock.mockResolvedValueOnce({ wallet: { balance: 3 } });
    walletMock.mockResolvedValue({ wallet: { balance: 2 } });
    const { onUnlock } = renderCard();

    expect(await screen.findByText('premiumCreditBalance:{"count":3}')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'premiumUnlockButton' });
    expect(button).toBeEnabled();
    expect(button).toHaveTextContent('premiumUnlockButton');
    expect(screen.getByRole('link', { name: 'premiumUpgradeLink' })).toHaveAttribute(
      'href',
      '/subscription',
    );
    expect(screen.getByRole('link', { name: /premiumBackToCatalog/ })).toHaveAttribute(
      'href',
      '/premium-quizzes',
    );

    fireEvent.click(button);

    await waitFor(() => expect(onUnlock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('premiumCreditBalance:{"count":2}')).toBeInTheDocument();
  });

  it('at 0 credits makes the upgrade link the primary action and disables the unlock', async () => {
    walletMock.mockResolvedValue({ wallet: { balance: 0 } });
    const { onUnlock } = renderCard();

    const button = await screen.findByRole('button', { name: 'premiumNotEnoughCredits' });
    expect(button).toBeDisabled();
    expect(screen.getByText('premiumCreditBalance:{"count":0}')).toBeInTheDocument();
    const upgrade = screen.getByRole('link', { name: 'premiumUpgradeLink' });
    expect(upgrade).toHaveClass('btn-primary');
    expect(upgrade.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(button);
    expect(onUnlock).not.toHaveBeenCalled();
  });

  it('keeps the unlock available while the balance is unknown and shows the error inline', async () => {
    walletMock.mockRejectedValue(new Error('offline'));
    renderCard({ error: 'premiumUnlockError' });

    expect(await screen.findByRole('alert')).toHaveTextContent('premiumUnlockError');
    expect(screen.getByRole('button', { name: 'premiumUnlockButton' })).toBeEnabled();
    expect(screen.queryByText(/premiumCreditBalance/)).not.toBeInTheDocument();
  });

  it('renders no main landmark of its own (the app layout owns it)', async () => {
    walletMock.mockResolvedValue({ wallet: { balance: 1 } });
    renderCard();

    await screen.findByText('premiumCreditBalance:{"count":1}');
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });
});
