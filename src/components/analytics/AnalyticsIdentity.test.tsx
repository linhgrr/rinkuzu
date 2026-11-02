/** @vitest-environment jsdom */

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsIdentity } from './AnalyticsIdentity';

const mocks = vi.hoisted(() => {
  let consent: 'granted' | 'denied' | null = 'denied';
  const listeners = new Set<() => void>();
  return {
    get consent() {
      return consent;
    },
    setConsent(value: 'granted' | 'denied' | null) {
      consent = value;
      for (const listener of listeners) listener();
    },
    identify: vi.fn(),
    capturePendingSignup: vi.fn(),
    capturePendingLogin: vi.fn(),
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
});

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: 'user-123', role: 'user', isNewAccount: true } },
  }),
}));

vi.mock('@/lib/analytics/client', () => ({
  capturePendingAnalyticsLogin: mocks.capturePendingLogin,
  capturePendingAnalyticsSignup: mocks.capturePendingSignup,
  getAnalyticsConsent: () => mocks.consent,
  identifyAnalyticsUser: mocks.identify,
  subscribeToAnalyticsConsent: mocks.subscribe,
}));

describe('AnalyticsIdentity', () => {
  afterEach(() => {
    cleanup();
    mocks.identify.mockClear();
    mocks.capturePendingSignup.mockClear();
    mocks.capturePendingLogin.mockClear();
    mocks.setConsent('denied');
  });

  it('identifies an existing session before completing pending login telemetry', async () => {
    mocks.identify.mockResolvedValue(undefined);
    render(<AnalyticsIdentity />);
    expect(mocks.identify).not.toHaveBeenCalled();

    act(() => mocks.setConsent('granted'));

    expect(mocks.identify).toHaveBeenCalledWith('user-123', { role: 'user' });
    await vi.waitFor(() => expect(mocks.capturePendingSignup).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(mocks.capturePendingLogin).toHaveBeenCalledOnce());
    expect(mocks.capturePendingLogin).toHaveBeenCalledWith({ isNewAccount: true });
    expect(mocks.identify.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.capturePendingSignup.mock.invocationCallOrder[0] ?? 0,
    );
    expect(mocks.capturePendingSignup.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.capturePendingLogin.mock.invocationCallOrder[0] ?? 0,
    );
  });
});
