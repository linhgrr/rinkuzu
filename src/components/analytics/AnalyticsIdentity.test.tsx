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
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
});

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: 'user-123', role: 'user' } },
  }),
}));

vi.mock('@/lib/analytics/client', () => ({
  getAnalyticsConsent: () => mocks.consent,
  identifyAnalyticsUser: mocks.identify,
  subscribeToAnalyticsConsent: mocks.subscribe,
}));

describe('AnalyticsIdentity', () => {
  afterEach(() => {
    cleanup();
    mocks.identify.mockClear();
    mocks.setConsent('denied');
  });

  it('identifies an existing session when consent is granted after mount', () => {
    render(<AnalyticsIdentity />);
    expect(mocks.identify).not.toHaveBeenCalled();

    act(() => mocks.setConsent('granted'));

    expect(mocks.identify).toHaveBeenCalledWith('user-123', { role: 'user' });
  });
});
