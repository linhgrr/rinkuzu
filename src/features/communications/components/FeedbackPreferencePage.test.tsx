import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiResponseError } from '@/lib/api/client';
import { FeedbackPreferencePage } from './FeedbackPreferencePage';

const mocks = vi.hoisted(() => ({ applyFeedbackPreference: vi.fn() }));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  Link: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock('../api/communications-api', () => ({
  applyFeedbackPreference: mocks.applyFeedbackPreference,
}));

const TOKEN = 'feedback-token';

async function click(name: string): Promise<void> {
  await userEvent.setup().click(screen.getByRole('button', { name }));
}

describe('FeedbackPreferencePage', () => {
  beforeEach(() => {
    mocks.applyFeedbackPreference.mockReset();
  });

  it('decline link: the decline choice first, opt-out-all second, no home link yet', () => {
    render(<FeedbackPreferencePage token={TOKEN} initialAction="decline" />);

    expect(screen.getByRole('heading', { name: 'title' })).toBeInTheDocument();
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(['decline', 'optOutAll']);
    expect(buttons[0]).toBeEnabled();
    expect(screen.queryByRole('link', { name: 'home' })).toBeNull();
  });

  it('opt-out link: one opt-out button', async () => {
    mocks.applyFeedbackPreference.mockResolvedValue({});
    render(<FeedbackPreferencePage token={TOKEN} initialAction="opt_out" />);

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['optOut']);
    await click('optOut');
    expect(mocks.applyFeedbackPreference).toHaveBeenCalledWith(TOKEN, 'opt_out');
  });

  it('missing token (RIN-981): invalid-link state, no submit, a way home', () => {
    render(<FeedbackPreferencePage token="" initialAction="decline" />);

    expect(screen.getByRole('heading', { name: 'invalidTitle' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('link', { name: 'home' })).toHaveAttribute('href', '/');
    expect(mocks.applyFeedbackPreference).not.toHaveBeenCalled();
  });

  it('done (RIN-981): records the choice, success copy, no buttons, a way home', async () => {
    mocks.applyFeedbackPreference.mockResolvedValue({});
    render(<FeedbackPreferencePage token={TOKEN} initialAction="decline" />);

    await click('decline');

    expect(await screen.findByRole('heading', { name: 'doneTitle' })).toBeInTheDocument();
    expect(screen.getByText('done')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('link', { name: 'home' })).toHaveAttribute('href', '/');
    expect(mocks.applyFeedbackPreference).toHaveBeenCalledWith(TOKEN, 'decline');
  });

  it('an invalid or expired link shows the invalid-link state, never the server text (RIN-980)', async () => {
    mocks.applyFeedbackPreference.mockRejectedValue(
      new ApiResponseError({
        payload: null,
        message: 'Invalid or expired token',
        status: 400,
        code: 'invalid_token',
      }),
    );
    render(<FeedbackPreferencePage token={TOKEN} initialAction="decline" />);

    await click('decline');

    expect(await screen.findByRole('heading', { name: 'invalidTitle' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/Invalid or expired/)).not.toBeInTheDocument();
  });

  it.each([
    [
      new ApiResponseError({ payload: null, message: 'Too many requests', status: 429 }),
      'errors.api.rateLimited',
    ],
    [
      new ApiResponseError({ payload: null, message: 'MongoServerError', status: 500 }),
      'errors.api.server',
    ],
    [new TypeError('Failed to fetch'), 'errors.api.network'],
  ])(
    'shows the shared API copy for %s, keeps the retry and adds a way home',
    async (error, expected) => {
      mocks.applyFeedbackPreference.mockRejectedValue(error);
      render(<FeedbackPreferencePage token={TOKEN} initialAction="decline" />);

      await click('decline');

      expect(await screen.findByRole('alert')).toHaveTextContent(expected);
      expect(screen.queryByText(error.message)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'decline' })).toBeEnabled();
      expect(screen.getByRole('link', { name: 'home' })).toBeInTheDocument();
    },
  );
});
