import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SingleSessionGuard } from '@/features/auth/components/SingleSessionGuard';

const { toastErrorMock, useSessionMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
  useSessionMock: vi.fn(),
}));

vi.mock('next-auth/react', () => ({ useSession: useSessionMock }));
vi.mock('next-intl', () => ({
  useLocale: () => 'vi',
  useTranslations: () => (key: string) => key,
}));
vi.mock('sonner', () => ({ toast: { error: toastErrorMock } }));

describe('SingleSessionGuard', () => {
  let requestSubmitMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    requestSubmitMock = vi
      .spyOn(HTMLFormElement.prototype, 'requestSubmit')
      .mockImplementation(() => undefined);
    toastErrorMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    requestSubmitMock.mockRestore();
  });

  it('does nothing while the current session is active', () => {
    useSessionMock.mockReturnValue({
      data: { user: { id: 'user-1', role: 'user' }, expires: '2099-01-01' },
    });

    render(<SingleSessionGuard />);

    expect(toastErrorMock).not.toHaveBeenCalled();
    expect(requestSubmitMock).not.toHaveBeenCalled();
  });

  it('announces replacement and submits the localized session-replacement logout', () => {
    useSessionMock.mockReturnValue({
      data: { expires: '2099-01-01', invalidatedReason: 'session_replaced' },
    });

    const { container } = render(<SingleSessionGuard />);

    expect(toastErrorMock).toHaveBeenCalledWith('sessionReplaced');
    const form = container.querySelector('form');
    expect(form).toHaveAttribute('action', '/api/session/logout');
    expect(Object.fromEntries(new FormData(form ?? undefined))).toEqual({
      locale: 'vi',
      reason: 'session_replaced',
    });

    act(() => vi.advanceTimersByTime(1_500));
    expect(requestSubmitMock).toHaveBeenCalledOnce();
  });

  it('submits only once when the invalidated session re-renders', () => {
    useSessionMock.mockReturnValue({
      data: { expires: '2099-01-01', invalidatedReason: 'session_replaced' },
    });

    const { rerender } = render(<SingleSessionGuard />);
    rerender(<SingleSessionGuard />);

    act(() => vi.advanceTimersByTime(1_500));
    expect(toastErrorMock).toHaveBeenCalledOnce();
    expect(requestSubmitMock).toHaveBeenCalledOnce();
  });
});
