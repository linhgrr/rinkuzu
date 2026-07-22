import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiResponseError } from './client';
import { reportApiError, subscribeToApiErrors } from './error-events';

describe('API error events', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('notifies browser observers and supports cleanup', () => {
    vi.stubGlobal('window', {});
    const listener = vi.fn();
    const unsubscribe = subscribeToApiErrors(listener);
    const error = new ApiResponseError({
      message: 'Usage quota exceeded',
      status: 429,
      payload: null,
      code: 'quota_exceeded',
      meta: { tier: 'free', upgradeEligible: true },
    });

    reportApiError(error);
    expect(listener).toHaveBeenCalledWith(error);

    unsubscribe();
    reportApiError(error);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not notify on the server', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToApiErrors(listener);
    reportApiError(new ApiResponseError({ message: 'Limit reached', status: 429, payload: null }));

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});
