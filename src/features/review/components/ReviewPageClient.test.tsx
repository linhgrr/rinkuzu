/** @vitest-environment jsdom */

import type { ReactNode } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiResponseError } from '@/lib/api/client';
import { ReviewPageClient } from './ReviewPageClient';

const { fetchDueMock, routerPushMock, submitMock, toastErrorMock } = vi.hoisted(() => ({
  fetchDueMock: vi.fn(),
  routerPushMock: vi.fn(),
  submitMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => '/review',
  useRouter: () => ({ push: routerPushMock, back: vi.fn() }),
}));

vi.mock('sonner', () => ({ toast: { error: toastErrorMock, success: vi.fn() } }));

vi.mock('@/features/review/api/review-session-api', () => ({
  fetchDueReviewQuestionViewModels: fetchDueMock,
  submitReviewAnswer: submitMock,
}));

vi.mock('@/features/review/components/ReviewCard', async () => {
  const { Button } = await import('@/components/ui/Button');
  return {
    default: ({ onResult }: { onResult: (rating: string) => void }) => (
      <Button onClick={() => onResult('good')}>rate-good</Button>
    ),
  };
});

const failure = (status: number, code: string) =>
  new ApiResponseError({
    message: 'Cursor timeout reviewing learner@example.com',
    status,
    payload: { success: false, error: { code } },
    code,
    detail: 'Cursor timeout reviewing learner@example.com',
  });

const dueQuestion = { id: 'review-1', questionRef: { id: 'question-1' } };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('ReviewPageClient API errors (RIN-755)', () => {
  it('shows an inline ErrorState with retry when due reviews fail to load', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const user = userEvent.setup();
    fetchDueMock.mockRejectedValueOnce(failure(500, 'internal_error')).mockResolvedValueOnce([]);

    render(<ReviewPageClient />);

    expect((await screen.findByRole('alert')).textContent).toContain('errors.api.server');
    expect(document.body.textContent).not.toContain('learner@example.com');

    await user.click(screen.getByRole('button', { name: 'common.retry' }));

    expect(await screen.findByText('noCards')).toBeTruthy();
    expect(fetchDueMock).toHaveBeenCalledTimes(2);
  });

  it('offers sign-in when the session expired while loading', async () => {
    fetchDueMock.mockRejectedValueOnce(failure(401, 'unauthorized'));

    render(<ReviewPageClient />);

    const signIn = await screen.findByRole('link', { name: 'errors.api.actions.signIn' });
    expect(signIn.getAttribute('href')).toBe(`/login?callbackUrl=${encodeURIComponent('/review')}`);
  });

  it('toasts localized copy when a rating fails to save and keeps the card', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const user = userEvent.setup();
    fetchDueMock.mockResolvedValueOnce([dueQuestion]);
    submitMock.mockRejectedValueOnce(failure(503, 'service_unavailable'));

    render(<ReviewPageClient />);
    await user.click(await screen.findByRole('button', { name: 'rate-good' }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('errors.api.unavailable'));
    expect(JSON.stringify(toastErrorMock.mock.calls)).not.toContain('learner@example.com');
    expect(screen.getByRole('button', { name: 'rate-good' })).toBeTruthy();
  });

  it('sends an expired session to sign-in when a rating fails with 401', async () => {
    const user = userEvent.setup();
    fetchDueMock.mockResolvedValueOnce([dueQuestion]);
    submitMock.mockRejectedValueOnce(failure(401, 'unauthorized'));

    render(<ReviewPageClient />);
    await user.click(await screen.findByRole('button', { name: 'rate-good' }));

    await waitFor(() => expect(routerPushMock).toHaveBeenCalledTimes(1));
    expect(String(routerPushMock.mock.calls[0]?.[0])).toMatch(/^\/login\?callbackUrl=/);
    expect(toastErrorMock).not.toHaveBeenCalled();
  });
});
