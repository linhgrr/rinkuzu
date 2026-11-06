import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiResponseError } from '@/lib/api/client';
import { FeedbackPreferencePage } from './FeedbackPreferencePage';

const mocks = vi.hoisted(() => ({ applyFeedbackPreference: vi.fn() }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('token=feedback-token'),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock('../api/communications-api', () => ({
  applyFeedbackPreference: mocks.applyFeedbackPreference,
}));

async function decline(): Promise<void> {
  await userEvent.setup().click(screen.getByRole('button', { name: 'decline' }));
}

describe('FeedbackPreferencePage (RIN-980: never the server text)', () => {
  beforeEach(() => {
    mocks.applyFeedbackPreference.mockReset();
  });

  it('records the choice', async () => {
    mocks.applyFeedbackPreference.mockResolvedValue({});

    render(<FeedbackPreferencePage />);
    await decline();

    expect(await screen.findByRole('status')).toHaveTextContent('done');
    expect(mocks.applyFeedbackPreference).toHaveBeenCalledWith('feedback-token', 'decline');
  });

  it('shows the page copy for an invalid or expired link', async () => {
    mocks.applyFeedbackPreference.mockRejectedValue(
      new ApiResponseError({
        payload: null,
        message: 'Invalid or expired token',
        status: 400,
        code: 'invalid_token',
      }),
    );

    render(<FeedbackPreferencePage />);
    await decline();

    expect(await screen.findByRole('alert')).toHaveTextContent('error');
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
  ])('shows the shared API copy for %s', async (error, expected) => {
    mocks.applyFeedbackPreference.mockRejectedValue(error);

    render(<FeedbackPreferencePage />);
    await decline();

    expect(await screen.findByRole('alert')).toHaveTextContent(expected);
    expect(screen.queryByText(error.message)).not.toBeInTheDocument();
  });
});
