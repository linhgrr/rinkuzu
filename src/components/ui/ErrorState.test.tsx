/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';

import { act, fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { NextIntlClientProvider } from 'next-intl';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enCommon from '@/../messages/en/common.json';
import enErrors from '@/../messages/en/errors.json';
import viCommon from '@/../messages/vi/common.json';
import viErrors from '@/../messages/vi/errors.json';
import { ErrorState } from './ErrorState';

const pushMock = vi.fn();
const backMock = vi.fn();

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => '/quiz/abc',
  useRouter: () => ({ push: pushMock, back: backMock }),
}));

interface FakeApiError {
  status?: number;
  code?: string;
  retryAfterSeconds?: number;
  message?: string;
}

function apiError(fields: FakeApiError): FakeApiError {
  return { message: 'Mongo timeout for learner secret@example.com', ...fields };
}

function renderIn(ui: ReactNode, locale: 'vi' | 'en' = 'en') {
  const messages =
    locale === 'vi'
      ? { common: viCommon, errors: viErrors }
      : { common: enCommon, errors: enErrors };
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const retryButton = () => screen.getByRole('button', { name: 'Retry' });
const queryButtons = () => screen.queryAllByRole('button').map((button) => button.textContent);
const queryLinks = () =>
  screen.queryAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')]);

beforeEach(() => {
  pushMock.mockReset();
  backMock.mockReset();
  window.history.replaceState(null, '', '/en/quiz/abc?tab=review');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ErrorState legacy message', () => {
  it('announces the error and preserves the retry action', async () => {
    const onRetry = vi.fn();
    const { container } = renderIn(<ErrorState message="Could not load" onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load');
    retryButton().click();
    expect(onRetry).toHaveBeenCalledOnce();
    expect((await axe(container)).violations).toEqual([]);
  });

  it('renders a custom action when retry is absent', () => {
    renderIn(
      <ErrorState message="Could not load" action={<button type="button">Get help</button>} />,
    );
    expect(screen.getByRole('button', { name: 'Get help' })).toBeInTheDocument();
  });
});

describe('ErrorState from an API error', () => {
  it('auth_required: neutral sign-in link that keeps the current path and search', async () => {
    const { container } = renderIn(
      <ErrorState error={apiError({ status: 401, code: 'unauthorized' })} onRetry={vi.fn()} />,
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(enErrors.api.authRequiredTitle);
    expect(queryButtons()).toEqual([]);
    expect(queryLinks()).toEqual([['Sign in', '/login?callbackUrl=%2Fquiz%2Fabc']]);

    fireEvent.click(screen.getByRole('link', { name: 'Sign in' }));
    expect(pushMock).toHaveBeenCalledWith('/login?callbackUrl=%2Fquiz%2Fabc%3Ftab%3Dreview');
    expect((await axe(container)).violations).toEqual([]);
  });

  it('auth_required page adds Go home', () => {
    renderIn(<ErrorState variant="page" error={apiError({ status: 401 })} />);
    expect(queryLinks()).toEqual([
      ['Sign in', '/login?callbackUrl=%2Fquiz%2Fabc'],
      ['Go home', '/'],
    ]);
  });

  it('unlock_required: Upgrade to /subscription plus Back, code copy wins', () => {
    renderIn(<ErrorState error={apiError({ status: 403, code: 'quota_exceeded' })} />);

    expect(screen.getByRole('status')).toHaveTextContent(enErrors.api.codes.quotaExceededTitle);
    expect(queryLinks()).toEqual([['Upgrade', '/subscription']]);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(backMock).toHaveBeenCalledOnce();
  });

  it.each([
    ['inline', [['Go home', '/']], []],
    ['page', [['Go home', '/']], ['Back']],
  ] as const)('forbidden %s: Go home, no retry', (variant, links, buttons) => {
    renderIn(<ErrorState variant={variant} error={apiError({ status: 403 })} onRetry={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent(enErrors.api.forbiddenTitle);
    expect(queryLinks()).toEqual(links);
    expect(queryButtons()).toEqual(buttons);
  });

  it('not_found: Go home and Back, never Retry', () => {
    renderIn(<ErrorState error={apiError({ status: 404 })} onRetry={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent(enErrors.api.notFoundTitle);
    expect(queryLinks()).toEqual([['Go home', '/']]);
    expect(queryButtons()).toEqual(['Back']);
  });

  it('conflict: Reload calls onRetry', () => {
    const onRetry = vi.fn();
    renderIn(<ErrorState error={apiError({ status: 409 })} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('rate_limited: Retry is disabled and counts down retryAfterSeconds', () => {
    vi.useFakeTimers();
    const onRetry = vi.fn();
    renderIn(
      <ErrorState error={apiError({ status: 429, retryAfterSeconds: 3 })} onRetry={onRetry} />,
    );

    const button = retryButton();
    expect(screen.getByRole('status')).toHaveTextContent('You can try again in 3 seconds.');
    expect(button).toHaveTextContent('Retry (3s)');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(button);
    expect(onRetry).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1000));
    expect(button).toHaveTextContent('Retry (2s)');
    expect(screen.queryByText(enErrors.api.retryNow)).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(2000));
    expect(button).toHaveTextContent(/^Retry$/);
    expect(button).not.toHaveAttribute('aria-disabled');
    expect(screen.getByText(enErrors.api.retryNow)).toHaveClass('sr-only');
    fireEvent.click(button);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('rate_limited without a time: plain Retry', () => {
    const onRetry = vi.fn();
    renderIn(<ErrorState error={apiError({ status: 429 })} onRetry={onRetry} />);
    expect(screen.getByRole('status')).toHaveTextContent(enErrors.api.rateLimited);
    fireEvent.click(retryButton());
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('request_in_progress: Retry waits 3 seconds', () => {
    vi.useFakeTimers();
    renderIn(
      <ErrorState
        error={apiError({ status: 409, code: 'request_in_progress' })}
        onRetry={vi.fn()}
      />,
    );
    expect(retryButton()).toHaveTextContent('Retry (3s)');
    act(() => vi.advanceTimersByTime(3000));
    expect(retryButton()).not.toHaveAttribute('aria-disabled');
  });

  it('aborted renders nothing', () => {
    const { container } = renderIn(
      <ErrorState error={new DOMException('aborted', 'AbortError')} onRetry={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ['server', { status: 500, code: 'internal_error' }, 'alert', enErrors.api.serverTitle],
    ['unavailable', { status: 503 }, 'status', enErrors.api.unavailableTitle],
    ['unknown', { status: 418 }, 'alert', enErrors.api.genericTitle],
  ] as const)('%s page: Retry, Go home and a support code', (_kind, fields, role, title) => {
    const onRetry = vi.fn();
    renderIn(<ErrorState variant="page" error={apiError(fields)} onRetry={onRetry} />);

    const container = screen.getByRole(role);
    expect(container).toHaveTextContent(title);
    expect(container).not.toHaveTextContent('secret');
    expect(queryLinks()).toEqual([['Go home', '/']]);
    fireEvent.click(retryButton());
    expect(onRetry).toHaveBeenCalledOnce();
    if ('code' in fields) expect(container).toHaveTextContent('Code: internal_error');
  });

  it('server inline: Retry only, no support code', () => {
    renderIn(
      <ErrorState error={apiError({ status: 500, code: 'internal_error' })} onRetry={vi.fn()} />,
    );
    expect(queryButtons()).toEqual(['Retry']);
    expect(queryLinks()).toEqual([]);
    expect(screen.getByRole('alert')).not.toHaveTextContent('internal_error');
  });

  it('network: info tone Retry; no handler means no button inline, Go home on a page', () => {
    const { unmount } = renderIn(<ErrorState error={new TypeError('Failed to fetch')} />);
    expect(screen.getByRole('status')).toHaveTextContent(enErrors.api.networkTitle);
    expect(queryButtons()).toEqual([]);
    expect(queryLinks()).toEqual([]);
    unmount();

    renderIn(<ErrorState variant="page" error={new TypeError('Failed to fetch')} />);
    expect(queryLinks()).toEqual([['Go home', '/']]);
  });

  it('validation: the form owns the fix, Retry only with a handler', () => {
    const { unmount } = renderIn(<ErrorState error={apiError({ status: 400 })} />);
    expect(screen.getByRole('alert')).toHaveTextContent(enErrors.api.validationTitle);
    expect(queryButtons()).toEqual([]);
    unmount();

    renderIn(<ErrorState error={apiError({ status: 400 })} onRetry={vi.fn()} />);
    expect(queryButtons()).toEqual(['Retry']);
  });

  it('payment_creation_disabled page: Go home, no Retry', () => {
    renderIn(
      <ErrorState
        variant="page"
        error={apiError({ status: 503, code: 'payment_creation_disabled' })}
        onRetry={vi.fn()}
      />,
    );
    expect(queryButtons()).toEqual([]);
    expect(queryLinks()).toEqual([['Go home', '/']]);
  });

  it('a localized message replaces the body copy', () => {
    renderIn(<ErrorState error={apiError({ status: 500 })} message="Could not load the quiz" />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Could not load the quiz');
    expect(alert).not.toHaveTextContent(enErrors.api.server);
  });

  it('page variant moves focus to the title on mount', () => {
    renderIn(<ErrorState variant="page" error={apiError({ status: 404 })} />);
    expect(screen.getByRole('heading', { name: enErrors.api.notFoundTitle })).toHaveFocus();
  });

  it('retry in flight: spinner, aria-busy, then focus back on Retry', async () => {
    let settle: () => void = () => undefined;
    const onRetry = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          settle = resolve;
        }),
    );
    renderIn(<ErrorState error={apiError({ status: 500 })} onRetry={onRetry} />);

    fireEvent.click(retryButton());
    expect(screen.getByRole('alert')).toHaveAttribute('aria-busy', 'true');
    expect(retryButton()).toBeDisabled();

    await act(async () => settle());
    expect(screen.getByRole('alert')).not.toHaveAttribute('aria-busy');
    expect(retryButton()).toHaveFocus();
  });

  it('renders Vietnamese copy', () => {
    renderIn(<ErrorState error={apiError({ status: 401 })} />, 'vi');
    expect(screen.getByRole('status')).toHaveTextContent(viErrors.api.authRequiredTitle);
    expect(screen.getByRole('link', { name: 'Đăng nhập' })).toBeInTheDocument();
  });
});
