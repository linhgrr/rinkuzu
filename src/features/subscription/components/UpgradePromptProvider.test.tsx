/** @vitest-environment jsdom */

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiResponseError } from '@/lib/api/client';
import { reportApiError } from '@/lib/api/error-events';
import { UpgradePromptProvider } from './UpgradePromptProvider';

const { pushMock, toastInfoMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  toastInfoMock: vi.fn(),
}));

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ push: pushMock }) }));
vi.mock('sonner', () => ({ toast: { info: toastInfoMock } }));
vi.mock('@/features/subscription/components/UpgradePaywallModal', () => ({
  UpgradePaywallModal: ({ isOpen, kind }: { isOpen: boolean; kind: 'quota' | 'feature' }) =>
    isOpen ? <section aria-label="limitReachedTitle" data-kind={kind} /> : null,
}));

describe('UpgradePromptProvider', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('opens the shared prompt for upgrade-eligible free-tier quota errors', () => {
    render(<UpgradePromptProvider>content</UpgradePromptProvider>);

    act(() => {
      reportApiError(
        new ApiResponseError({
          message: 'Usage quota exceeded',
          status: 429,
          payload: null,
          code: 'quota_exceeded',
          meta: { tier: 'free', upgradeEligible: true },
        }),
      );
    });

    expect(screen.getByRole('region', { name: 'limitReachedTitle' })).toBeTruthy();
  });

  it('does not offer an upgrade for premium-tier quota exhaustion', () => {
    render(<UpgradePromptProvider>content</UpgradePromptProvider>);

    act(() => {
      reportApiError(
        new ApiResponseError({
          message: 'Usage quota exceeded',
          status: 429,
          payload: null,
          code: 'quota_exceeded',
          meta: { tier: 'premium', upgradeEligible: false },
        }),
      );
    });

    expect(screen.queryByRole('region', { name: 'limitReachedTitle' })).toBeNull();
  });

  it('ignores unrelated rate-limit errors', () => {
    render(<UpgradePromptProvider>content</UpgradePromptProvider>);

    act(() => {
      reportApiError(
        new ApiResponseError({
          message: 'Too many sign-in attempts',
          status: 429,
          payload: null,
          code: 'rate_limit_exceeded',
        }),
      );
    });

    expect(screen.queryByRole('region', { name: 'limitReachedTitle' })).toBeNull();
  });

  // A locked Premium quiz answers the session start with premium_required/unlock_required.
  // The unlock card offers the cheaper credit unlock first (RIN-1014), so no paywall on load.
  it('leaves a locked Premium quiz to its unlock card instead of opening the paywall', () => {
    render(<UpgradePromptProvider>content</UpgradePromptProvider>);

    act(() => {
      reportApiError(
        new ApiResponseError({
          message: 'Premium subscription or one credit is required',
          status: 403,
          payload: null,
          code: 'premium_required',
          meta: { reason: 'unlock_required' },
        }),
      );
    });

    expect(screen.queryByRole('region', { name: 'limitReachedTitle' })).toBeNull();
  });

  it('opens the paywall when a credit unlock fails for insufficient credits', () => {
    render(<UpgradePromptProvider>content</UpgradePromptProvider>);

    act(() => {
      reportApiError(
        new ApiResponseError({
          message: 'Not enough credits',
          status: 403,
          payload: null,
          code: 'premium_required',
          meta: { reason: 'insufficient_credits' },
        }),
      );
    });

    expect(screen.getByRole('region', { name: 'limitReachedTitle' })).toBeTruthy();
  });
});
