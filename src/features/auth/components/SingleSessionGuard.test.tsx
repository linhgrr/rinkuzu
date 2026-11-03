import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SingleSessionGuard } from '@/features/auth/components/SingleSessionGuard';

const { getSessionMock, toastErrorMock, useSessionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  toastErrorMock: vi.fn(),
  useSessionMock: vi.fn(),
}));

vi.mock('next-auth/react', () => ({ getSession: getSessionMock, useSession: useSessionMock }));
vi.mock('next-intl', () => ({
  useLocale: () => 'vi',
  useTranslations: () => (key: string) => key,
}));
vi.mock('sonner', () => ({ toast: { error: toastErrorMock } }));

describe('SingleSessionGuard', () => {
  let requestSubmitMock: ReturnType<typeof vi.spyOn>;
  let visibility: DocumentVisibilityState;

  function respondWith(body: unknown) {
    getSessionMock.mockResolvedValue(body);
  }

  function setVisibility(state: DocumentVisibilityState) {
    visibility = state;
    document.dispatchEvent(new Event('visibilitychange'));
  }

  beforeEach(() => {
    vi.useFakeTimers();
    requestSubmitMock = vi
      .spyOn(HTMLFormElement.prototype, 'requestSubmit')
      .mockImplementation(() => undefined);
    toastErrorMock.mockReset();
    getSessionMock.mockReset();
    respondWith({ user: { id: 'user-1', role: 'user' }, expires: '2099-01-01' });
    visibility = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
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

  describe('session check (RIN-687)', () => {
    const signedIn = { data: { user: { id: 'user-1', role: 'user' }, expires: '2099-01-01' } };

    it('checks the session once per 30 s tick while visible, without broadcasting', async () => {
      useSessionMock.mockReturnValue(signedIn);
      render(<SingleSessionGuard />);
      expect(getSessionMock).not.toHaveBeenCalled();

      await act(() => vi.advanceTimersByTimeAsync(29_999));
      expect(getSessionMock).not.toHaveBeenCalled();
      await act(() => vi.advanceTimersByTimeAsync(1));
      expect(getSessionMock).toHaveBeenCalledOnce();
      expect(getSessionMock).toHaveBeenCalledWith({ broadcast: false });

      await act(() => vi.advanceTimersByTimeAsync(60_000));
      expect(getSessionMock).toHaveBeenCalledTimes(3);
    });

    it('skips ticks while hidden and checks once when the tab becomes visible', async () => {
      useSessionMock.mockReturnValue(signedIn);
      render(<SingleSessionGuard />);

      act(() => setVisibility('hidden'));
      await act(() => vi.advanceTimersByTimeAsync(120_000));
      expect(getSessionMock).not.toHaveBeenCalled();

      await act(async () => setVisibility('visible'));
      expect(getSessionMock).toHaveBeenCalledOnce();
    });

    it('does not poll for signed-out visitors', async () => {
      useSessionMock.mockReturnValue({ data: null });
      render(<SingleSessionGuard />);

      await act(() => vi.advanceTimersByTimeAsync(120_000));
      await act(async () => setVisibility('visible'));
      expect(getSessionMock).not.toHaveBeenCalled();
    });

    it('signs out once when a check reports the session was replaced', async () => {
      useSessionMock.mockReturnValue(signedIn);
      respondWith({ expires: '2099-01-01', invalidatedReason: 'session_replaced' });
      render(<SingleSessionGuard />);

      await act(() => vi.advanceTimersByTimeAsync(30_000));
      expect(toastErrorMock).toHaveBeenCalledWith('sessionReplaced');
      await act(() => vi.advanceTimersByTimeAsync(31_500));
      expect(toastErrorMock).toHaveBeenCalledOnce();
      expect(requestSubmitMock).toHaveBeenCalledOnce();
    });

    it('keeps the session when a check fails', async () => {
      useSessionMock.mockReturnValue(signedIn);
      getSessionMock.mockRejectedValue(new TypeError('offline'));
      render(<SingleSessionGuard />);

      await act(() => vi.advanceTimersByTimeAsync(30_000));
      getSessionMock.mockResolvedValue(null);
      await act(() => vi.advanceTimersByTimeAsync(30_000));
      expect(getSessionMock).toHaveBeenCalledTimes(2);
      expect(toastErrorMock).not.toHaveBeenCalled();
    });
  });
});
