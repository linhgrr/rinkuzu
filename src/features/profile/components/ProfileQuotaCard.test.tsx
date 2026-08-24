/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntitlementSnapshot } from '@/types/entitlements';
import { ProfileQuotaCard } from './ProfileQuotaCard';

const { mutateMock, swrMock } = vi.hoisted(() => ({
  mutateMock: vi.fn(),
  swrMock: vi.fn(),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('swr', () => ({
  default: (...args: unknown[]) => swrMock(...args),
}));

const entitlements: EntitlementSnapshot = {
  tier: 'premium',
  capabilities: {
    premium_catalog: { kind: 'boolean', enabled: true },
    ask_rin_chan: {
      kind: 'metered',
      enabled: true,
      windows: [
        {
          window: 'day',
          used: 2,
          limit: 10,
          remaining: 8,
          resetsAt: '2026-08-13T00:00:00.000Z',
        },
      ],
    },
    quiz_extract: {
      kind: 'metered',
      enabled: true,
      windows: [],
    },
    adaptive_pipeline: {
      kind: 'metered',
      enabled: true,
      unmetered: true,
      windows: [],
    },
    adaptive_generation: {
      kind: 'metered',
      enabled: true,
      windows: [],
    },
  },
  constraints: {
    quiz_pdf_pages: 100,
    adaptive_pdf_pages: 100,
    pdf_upload_bytes: 10_000_000,
  },
};

describe('ProfileQuotaCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders entitlement usage and premium status from SWR data', () => {
    swrMock.mockReturnValue({
      data: entitlements,
      error: null,
      isLoading: false,
      mutate: mutateMock,
    });

    render(<ProfileQuotaCard />);

    expect(screen.getByText('premiumPlan')).toBeInTheDocument();
    expect(screen.getByText('quotaAskRin')).toBeInTheDocument();
    expect(screen.getByText('2 / 10')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'quotaPerDay' })).toHaveAttribute(
      'aria-valuenow',
      '2',
    );
    expect(screen.getByText('quotaUnlimited')).toBeInTheDocument();
  });

  it('retries the entitlement request through SWR mutate when loading fails', () => {
    swrMock.mockReturnValue({
      data: undefined,
      error: new Error('offline'),
      isLoading: false,
      mutate: mutateMock,
    });

    render(<ProfileQuotaCard />);
    fireEvent.click(screen.getByRole('button', { name: 'quotaRetry' }));

    expect(mutateMock).toHaveBeenCalledTimes(1);
  });
});
