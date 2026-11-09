/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({ status: 'authenticated' }));
const fetchApiData = vi.hoisted(() => vi.fn());
const capture = vi.hoisted(() => vi.fn());

const translate = (key: string, values?: Record<string, unknown>) =>
  values ? `${key}:${Object.values(values).map(String).join(',')}` : key;
vi.mock('next-intl', () => ({ useTranslations: () => translate, useLocale: () => 'en' }));
vi.mock('next-auth/react', () => ({ useSession: () => ({ status: session.status }) }));
vi.mock('@/lib/api/client', () => ({ fetchApiData }));
vi.mock('@/lib/analytics/client', () => ({ captureAnalyticsEvent: capture }));

import { AdaptiveReviewPrompt } from './AdaptiveReviewPrompt';

const OFFER = { optedIn: false, snoozedUntil: null, eligible: true };

describe('AdaptiveReviewPrompt (RIN-1364)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.status = 'authenticated';
    fetchApiData.mockImplementation((_url: string, init?: RequestInit) =>
      Promise.resolve(
        init?.method === 'POST'
          ? { optedIn: true, status: 'scheduled', scheduledFor: '2026-11-11T12:00:00.000Z' }
          : OFFER,
      ),
    );
  });

  it('asks a signed-in learner and opts in on the adaptive path with no timestamps', async () => {
    render(<AdaptiveReviewPrompt />);

    expect(await screen.findByText('reviewPromptQuestion')).toBeInTheDocument();
    expect(fetchApiData).toHaveBeenCalledWith('/api/user/review-reminder?path=adaptive');
    fireEvent.click(screen.getByRole('button', { name: 'remind' }));

    await waitFor(() => expect(capture).toHaveBeenCalledOnce());
    const post = fetchApiData.mock.calls.find(([, options]) => options?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({
      path: 'adaptive',
      locale: 'en',
      optIn: true,
    });
    expect(capture).toHaveBeenCalledWith('review_email_opt_in', {
      campaign: 'w1-review',
      source: 'adaptive_end_review',
    });
  });

  it('"No thanks" snoozes on the adaptive path', async () => {
    render(<AdaptiveReviewPrompt />);

    fireEvent.click(await screen.findByRole('button', { name: 'decline' }));

    await waitFor(() =>
      expect(fetchApiData).toHaveBeenCalledWith(
        '/api/user/review-reminder',
        expect.objectContaining({ body: JSON.stringify({ path: 'adaptive', action: 'snooze' }) }),
      ),
    );
  });

  it('renders nothing when the latest completion is not eligible', async () => {
    fetchApiData.mockResolvedValue({ ...OFFER, eligible: false });
    const { container } = render(<AdaptiveReviewPrompt />);

    await waitFor(() => expect(fetchApiData).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it.each(['unauthenticated', 'loading'])('is absent and calls nothing when %s', (status) => {
    session.status = status;
    const { container } = render(<AdaptiveReviewPrompt />);

    expect(container).toBeEmptyDOMElement();
    expect(fetchApiData).not.toHaveBeenCalled();
  });
});
