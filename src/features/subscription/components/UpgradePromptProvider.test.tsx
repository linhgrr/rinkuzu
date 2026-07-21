/** @vitest-environment jsdom */

import type { ReactNode } from 'react';
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
vi.mock('@/components/ui/Modal', () => ({
  Modal: ({ children, isOpen, title }: { children: ReactNode; isOpen: boolean; title: string }) =>
    isOpen ? <section aria-label={title}>{children}</section> : null,
}));

describe('UpgradePromptProvider', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('opens the shared prompt for entitlement errors', () => {
    render(<UpgradePromptProvider>content</UpgradePromptProvider>);

    act(() => {
      reportApiError(
        new ApiResponseError({
          message: 'LLM limit reached',
          status: 429,
          payload: null,
          code: 'llm_rate_limit_exceeded',
        }),
      );
    });

    expect(screen.getByRole('region', { name: 'limitReachedTitle' })).toBeTruthy();
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
});
