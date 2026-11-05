import { renderHook } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import enErrors from '@/../messages/en/errors.json';
import viErrors from '@/../messages/vi/errors.json';
import { ApiResponseError } from './client';
import {
  buildAuthRequiredHref,
  useAdminApiErrorMessage,
  useApiErrorMessage,
  useApiErrorToast,
  useAuthRequiredPrompt,
} from './use-api-error';

const pushMock = vi.fn();
const { toastErrorMock } = vi.hoisted(() => ({ toastErrorMock: vi.fn() }));

vi.mock('sonner', () => ({ toast: { error: toastErrorMock } }));

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

  it('uses the screen fallback only when the error has no code or status (RIN-754)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useApiErrorMessage(), { wrapper: wrapper('vi') });

    expect(result.current(new Error('pdf.js: Invalid XRef'), 'Không tải được')).toBe(
      'Không tải được',
    );
    expect(result.current(serverError(), 'Không tải được')).toBe(viErrors.api.server);
    expect(result.current(new TypeError('Failed to fetch'), 'Không tải được')).toBe(
      viErrors.api.network,
    );
  });
});

describe('useAdminApiErrorMessage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const adminError = (status: number, code: string) =>
    new ApiResponseError({
      message: 'Raw server text for admin secret@example.com',
      status,
      payload: { success: false, error: { code, message: 'secret@example.com' } },
      code,
      detail: 'secret@example.com',
    });

  it('adds the code (never the server text) to code-specific admin copy', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useAdminApiErrorMessage(), { wrapper: wrapper('en') });

    const message = result.current(adminError(409, 'last_active_admin'), 'Could not update user');

    expect(message).toBe(`${enErrors.api.codes.lastActiveAdmin} · Code: last_active_admin`);
    expect(message).not.toContain('secret');
  });

  it('uses the localized fallback for generic server errors and keeps kind copy otherwise', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useAdminApiErrorMessage(), { wrapper: wrapper('vi') });

    expect(result.current(serverError(), 'Không lưu được khóa')).toBe(
      'Không lưu được khóa · Mã: internal_error',
    );
    expect(result.current(new Error('raw secret@example.com'), 'Không tải được')).toBe(
      'Không tải được',
    );
    expect(result.current(adminError(403, 'forbidden'), 'Không tải được')).toBe(
      `${viErrors.api.forbidden} · Mã: forbidden`,
    );
    expect(result.current(new Error('raw secret@example.com'))).toBe(viErrors.api.generic);
    expect(result.current(new DOMException('aborted', 'AbortError'), 'x')).toBe('');
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

  it('falls back to the post-sign-in landing for blocked callback paths', () => {
    expect(buildAuthRequiredHref('/vi', 'vi')).toBe(
      `/login?callbackUrl=${encodeURIComponent('/start')}`,
    );
    expect(buildAuthRequiredHref('//evil.example/x', 'vi')).toBe(
      `/login?callbackUrl=${encodeURIComponent('/start')}`,
    );
  });
});

describe('useApiErrorToast', () => {
  afterEach(() => {
    pushMock.mockReset();
    toastErrorMock.mockReset();
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
  });

  it('toasts localized copy for a failed mutation, never the server text', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useApiErrorToast(), { wrapper: wrapper('en') });

    result.current(serverError());

    expect(toastErrorMock).toHaveBeenCalledWith(enErrors.api.server);
    expect(JSON.stringify(toastErrorMock.mock.calls)).not.toContain('secret');
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('sends an expired session to sign-in instead of toasting', () => {
    window.history.replaceState(null, '', '/en/profile?tab=settings');
    const { result } = renderHook(() => useApiErrorToast(), { wrapper: wrapper('en') });

    result.current(new ApiResponseError({ message: 'Unauthorized', status: 401, payload: null }));

    expect(toastErrorMock).not.toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith(
      `/login?callbackUrl=${encodeURIComponent('/profile?tab=settings')}`,
    );
  });

  it('shows nothing for an aborted request', () => {
    const { result } = renderHook(() => useApiErrorToast(), { wrapper: wrapper('en') });

    result.current(new DOMException('aborted', 'AbortError'));

    expect(toastErrorMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
