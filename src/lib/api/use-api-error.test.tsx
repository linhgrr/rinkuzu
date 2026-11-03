import { renderHook } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import enErrors from '@/../messages/en/errors.json';
import viErrors from '@/../messages/vi/errors.json';
import { ApiResponseError } from './client';
import { buildAuthRequiredHref, useApiErrorMessage, useAuthRequiredPrompt } from './use-api-error';

const pushMock = vi.fn();

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

function wrapper(locale: 'vi' | 'en') {
  const errors = locale === 'vi' ? viErrors : enErrors;
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={{ errors }}>
        {children}
      </NextIntlClientProvider>
    );
  };
}

const serverError = () =>
  new ApiResponseError({
    message: 'Mongo timeout for learner secret@example.com',
    status: 500,
    payload: { success: false, error: { code: 'internal_error', detail: 'secret@example.com' } },
    code: 'internal_error',
    detail: 'Mongo timeout for learner secret@example.com',
  });

describe('useApiErrorMessage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns localized copy and logs only kind, code and status', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useApiErrorMessage(), { wrapper: wrapper('vi') });

    const message = result.current(serverError());

    expect(message).toBe(viErrors.api.server);
    expect(message).not.toContain('secret');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('[api-error]', {
      kind: 'server',
      code: 'internal_error',
      status: 500,
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain('secret');
  });

  it('formats the rate-limit countdown and renders nothing for aborts', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useApiErrorMessage(), { wrapper: wrapper('en') });
    const limited = new ApiResponseError({
      message: 'Rate limit exceeded',
      status: 429,
      payload: null,
      code: 'rate_limit_exceeded',
      retryAfterSeconds: 30,
    });

    expect(result.current(limited)).toBe('You can try again in 30 seconds.');
    expect(result.current(new DOMException('aborted', 'AbortError'))).toBe('');
  });
});

describe('useAuthRequiredPrompt', () => {
  afterEach(() => {
    pushMock.mockReset();
    window.history.replaceState(null, '', '/');
  });

  it('pushes /login with the current locale-prefixed path and search as callbackUrl', () => {
    window.history.replaceState(null, '', '/en/quiz/abc?mode=review');
    const { result } = renderHook(() => useAuthRequiredPrompt(), { wrapper: wrapper('en') });

    result.current();

    expect(pushMock).toHaveBeenCalledWith(
      `/login?callbackUrl=${encodeURIComponent('/quiz/abc?mode=review')}`,
    );
  });

  it('falls back to the dashboard for blocked callback paths', () => {
    expect(buildAuthRequiredHref('/vi', 'vi')).toBe(
      `/login?callbackUrl=${encodeURIComponent('/dashboard')}`,
    );
    expect(buildAuthRequiredHref('//evil.example/x', 'vi')).toBe(
      `/login?callbackUrl=${encodeURIComponent('/dashboard')}`,
    );
  });
});
