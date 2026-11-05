/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResultActions } from './ResultActions';

const { fetchOptedInMock, saveMock, captureMock } = vi.hoisted(() => ({
  fetchOptedInMock: vi.fn(),
  saveMock: vi.fn(),
  captureMock: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const translate = Object.assign(
  (key: string, values?: Record<string, unknown>) =>
    values?.['count'] !== undefined ? `${key}:${String(values['count'])}` : key,
  { rich: (key: string, tags: { link: (chunks: ReactNode) => ReactNode }) => tags.link(key) },
);
vi.mock('next-intl', () => ({ useTranslations: () => translate, useLocale: () => 'en' }));

vi.mock('@/features/quiz/api/review-reminder-api', () => ({
  fetchReviewReminderOptedIn: (...args: unknown[]) => fetchOptedInMock(...args),
  saveReviewReminder: (...args: unknown[]) => saveMock(...args),
}));
vi.mock('@/lib/analytics/client', () => ({
  captureAnalyticsEvent: (...args: unknown[]) => captureMock(...args),
}));

const ATTEMPT_ID = '6a8ed20a3d0a1892cacdfe0b';
const baseProps = {
  attemptId: ATTEMPT_ID,
  resultPath: `/quiz/demo/result?attemptId=${ATTEMPT_ID}`,
  slug: 'demo',
  missedCount: 3,
  nextQuiz: { slug: 'starter-en', title: 'Starter' },
  viewer: 'signed_in' as const,
  contentLocked: false,
};

function primaryLinks() {
  return screen.getAllByRole('link').filter((link) => link.className.includes('btn-primary'));
}

describe('ResultActions (RIN-917)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchOptedInMock.mockResolvedValue(false);
    saveMock.mockResolvedValue(undefined);
  });

  it('makes "Retry the N you missed" the only primary, linking to the retry session', async () => {
    render(<ResultActions {...baseProps} />);
    const [primary, ...others] = primaryLinks();
    expect(others).toHaveLength(0);
    expect(primary).toHaveTextContent('retryMissed:3');
    expect(primary).toHaveAttribute('href', `/quiz/demo?retryOf=${ATTEMPT_ID}`);
    expect(screen.getByRole('link', { name: 'redo' })).toHaveAttribute('href', '/quiz/demo');
    expect(screen.getByRole('link', { name: 'backHome' })).toHaveClass('btn-secondary');

    fireEvent.click(primary!);
    expect(captureMock).toHaveBeenCalledWith('retry_missed_clicked', {
      campaign: 'w1-review',
      missed_count: 3,
    });
    await waitFor(() => expect(fetchOptedInMock).toHaveBeenCalled());
  });

  it('offers "Try another quiz" when nothing was missed', () => {
    render(<ResultActions {...baseProps} missedCount={0} />);
    const [primary, ...others] = primaryLinks();
    expect(others).toHaveLength(0);
    expect(primary).toHaveTextContent('tryAnother');
    expect(primary).toHaveAttribute('href', '/quiz/starter-en');
  });

  it('promotes Back Home to primary when nothing was missed and there is no next quiz', () => {
    render(<ResultActions {...baseProps} missedCount={0} nextQuiz={null} />);
    const [primary, ...others] = primaryLinks();
    expect(others).toHaveLength(0);
    expect(primary).toHaveTextContent('backHome');
    expect(screen.getAllByRole('link', { name: 'backHome' })).toHaveLength(1);
  });

  it('shows a guest the sign-in line instead of retry and the checkbox', () => {
    render(<ResultActions {...baseProps} viewer="guest" />);
    expect(screen.queryByText(/retryMissed/)).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'guestSignIn' })).toHaveAttribute(
      'href',
      expect.stringContaining('/login?callbackUrl='),
    );
    expect(fetchOptedInMock).not.toHaveBeenCalled();
  });

  it('hides retry and the checkbox on a content-locked result', () => {
    render(<ResultActions {...baseProps} contentLocked />);
    expect(screen.queryByText(/retryMissed/)).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('starts unticked and sends nothing until the learner ticks it', async () => {
    render(<ResultActions {...baseProps} />);
    const checkbox = screen.getByRole('checkbox', { name: 'reviewEmail' });
    await waitFor(() => expect(fetchOptedInMock).toHaveBeenCalled());
    expect(checkbox).not.toBeChecked();
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('shows saving then saved, and records the opt-in event', async () => {
    let resolveSave: () => void = () => undefined;
    saveMock.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveSave = resolve;
      }),
    );
    render(<ResultActions {...baseProps} />);
    const checkbox = screen.getByRole('checkbox', { name: 'reviewEmail' });

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(checkbox).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('saving');
    expect(saveMock).toHaveBeenCalledWith({ attemptId: ATTEMPT_ID, optIn: true, locale: 'en' });

    await act(async () => resolveSave());
    expect(screen.getByRole('status')).toHaveTextContent('savedOn');
    expect(checkbox).toBeEnabled();
    expect(captureMock).toHaveBeenCalledWith('review_email_opt_in', {
      campaign: 'w1-review',
      missed_count: 3,
    });
  });

  it('reverts on error and retries the same choice', async () => {
    saveMock.mockRejectedValueOnce(new Error('offline'));
    render(<ResultActions {...baseProps} />);
    const checkbox = screen.getByRole('checkbox', { name: 'reviewEmail' });

    fireEvent.click(checkbox);
    expect(await screen.findByText('saveError')).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'tryAgain' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('savedOn'));
    expect(checkbox).toBeChecked();
    expect(saveMock).toHaveBeenLastCalledWith({
      attemptId: ATTEMPT_ID,
      optIn: true,
      locale: 'en',
    });
  });

  it('shows the box ticked on revisit and un-ticks it', async () => {
    fetchOptedInMock.mockResolvedValue(true);
    render(<ResultActions {...baseProps} />);
    const checkbox = screen.getByRole('checkbox', { name: 'reviewEmail' });
    await waitFor(() => expect(checkbox).toBeChecked());

    fireEvent.click(checkbox);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('savedOff'));
    expect(saveMock).toHaveBeenCalledWith({ attemptId: ATTEMPT_ID, optIn: false, locale: 'en' });
    expect(captureMock).not.toHaveBeenCalledWith('review_email_opt_in', expect.anything());
  });
});
