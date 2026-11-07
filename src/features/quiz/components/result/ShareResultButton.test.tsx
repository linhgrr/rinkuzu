/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareResultButton } from './ShareResultButton';

const { captureMock, copyMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  captureMock: vi.fn(),
  copyMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

const translate = (key: string, values?: Record<string, unknown>) =>
  values ? `${key}:${String(values['count'])}:${String(values['title'])}` : key;
vi.mock('next-intl', () => ({ useTranslations: () => translate, useLocale: () => 'vi' }));
vi.mock('@/lib/analytics/client', () => ({
  captureAnalyticsEvent: (...args: unknown[]) => captureMock(...args),
}));
vi.mock('@/lib/clipboard', () => ({
  copyToClipboard: (...args: unknown[]) => copyMock(...args),
}));
vi.mock('sonner', () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}));

const SHARE = {
  quizId: 'quiz-1',
  slug: 'sinh-hoc',
  title: 'Sinh học',
  quizQuestionCount: 40,
  answeredCount: 10,
};
const QUICK_URL =
  'http://localhost:3000/vi/quiz/sinh-hoc?utm_source=share&utm_medium=result&utm_campaign=quiz-share&mode=quick';

function setNavigatorShare(share: ((data: ShareData) => Promise<void>) | undefined) {
  Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true });
}

function clickShare() {
  fireEvent.click(screen.getByRole('button', { name: 'share' }));
}

describe('ShareResultButton (RIN-1179)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    copyMock.mockResolvedValue(true);
  });

  afterEach(() => {
    setNavigatorShare(undefined);
  });

  it('opens the native share sheet with title, text and the share link, then emits method native', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    setNavigatorShare(shareMock);
    render(<ShareResultButton share={SHARE} isGuest={false} />);

    clickShare();

    await waitFor(() => expect(captureMock).toHaveBeenCalledTimes(1));
    expect(shareMock).toHaveBeenCalledWith({
      title: 'Sinh học',
      text: 'shareText:10:Sinh học',
      url: QUICK_URL,
    });
    expect(captureMock).toHaveBeenCalledWith('quiz_result_shared', {
      quizId: 'quiz-1',
      method: 'native',
      mode: 'quick',
      isGuest: false,
    });
    expect(copyMock).not.toHaveBeenCalled();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it('does nothing when the learner cancels the share sheet', async () => {
    const shareMock = vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError'));
    setNavigatorShare(shareMock);
    render(<ShareResultButton share={SHARE} isGuest={false} />);

    clickShare();

    await waitFor(() => expect(screen.getByRole('button', { name: 'share' })).toBeEnabled());
    expect(shareMock).toHaveBeenCalledTimes(1);
    expect(copyMock).not.toHaveBeenCalled();
    expect(captureMock).not.toHaveBeenCalled();
    expect(toastSuccessMock).not.toHaveBeenCalled();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('falls back to copy when the native share fails for another reason', async () => {
    setNavigatorShare(vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')));
    render(<ShareResultButton share={SHARE} isGuest />);

    clickShare();

    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith('shareCopied'));
    expect(copyMock).toHaveBeenCalledWith(QUICK_URL);
    expect(captureMock).toHaveBeenCalledWith('quiz_result_shared', {
      quizId: 'quiz-1',
      method: 'copy',
      mode: 'quick',
      isGuest: true,
    });
  });

  it('copies the link, toasts and emits method copy without navigator.share', async () => {
    render(<ShareResultButton share={{ ...SHARE, quizQuestionCount: 15 }} isGuest={false} />);

    clickShare();

    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith('shareCopied'));
    expect(copyMock).toHaveBeenCalledWith(
      'http://localhost:3000/vi/quiz/sinh-hoc?utm_source=share&utm_medium=result&utm_campaign=quiz-share',
    );
    expect(captureMock).toHaveBeenCalledWith('quiz_result_shared', {
      quizId: 'quiz-1',
      method: 'copy',
      mode: 'full',
      isGuest: false,
    });
  });

  it('shows an error toast and emits nothing when the copy fails', async () => {
    copyMock.mockResolvedValue(false);
    render(<ShareResultButton share={SHARE} isGuest={false} />);

    clickShare();

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('shareCopyFailed'));
    expect(toastSuccessMock).not.toHaveBeenCalled();
    expect(captureMock).not.toHaveBeenCalled();
  });

  it('is disabled while a share is in flight, so a double tap shares once', async () => {
    let resolveShare: () => void = () => undefined;
    const shareMock = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveShare = resolve;
        }),
    );
    setNavigatorShare(shareMock);
    render(<ShareResultButton share={SHARE} isGuest={false} />);

    clickShare();
    await waitFor(() => expect(screen.getByRole('button', { name: 'share' })).toBeDisabled());
    clickShare();
    resolveShare();

    await waitFor(() => expect(captureMock).toHaveBeenCalledTimes(1));
    expect(shareMock).toHaveBeenCalledTimes(1);
  });
});
