/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReviewReminderPromptStatus } from '@/features/quiz/types/quiz-result-page-view-model';
import { ReviewReminderPrompt } from './ReviewReminderPrompt';

const translate = (key: string, values?: Record<string, unknown>) =>
  values ? `${key}:${Object.values(values).map(String).join(',')}` : key;
vi.mock('next-intl', () => ({ useTranslations: () => translate, useLocale: () => 'en' }));

// Midday UTC, so the weekday is the same in every test runner time zone.
const SCHEDULED_FOR = '2026-11-11T12:00:00.000Z';
const WEDNESDAY = new Intl.DateTimeFormat('en', { weekday: 'long' }).format(
  new Date(SCHEDULED_FOR),
);
const OFFER: ReviewReminderPromptStatus = { optedIn: false, snoozedUntil: null, eligible: true };

const loadStatus = vi.fn();
const optIn = vi.fn();
const snooze = vi.fn();
const onOptIn = vi.fn();

function renderPrompt() {
  return render(
    <ReviewReminderPrompt
      missedCount={3}
      loadStatus={loadStatus}
      optIn={optIn}
      snooze={snooze}
      onOptIn={onOptIn}
    />,
  );
}

describe('ReviewReminderPrompt (RIN-1362)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadStatus.mockResolvedValue(OFFER);
    optIn.mockResolvedValue({ status: 'scheduled', scheduledFor: SCHEDULED_FOR });
    snooze.mockResolvedValue(undefined);
  });

  it('renders nothing while the status loads', () => {
    loadStatus.mockReturnValue(new Promise(() => undefined));
    const { container } = renderPrompt();
    expect(container).toBeEmptyDOMElement();
  });

  it('offers two unselected buttons of equal weight and sends nothing on render', async () => {
    renderPrompt();
    const remind = await screen.findByRole('button', { name: 'remind' });
    const decline = screen.getByRole('button', { name: 'decline' });
    expect(screen.getByText('question:3')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'question:3' })).toBeInTheDocument();
    expect(remind.className).toBe(decline.className);
    expect(remind).not.toHaveAttribute('aria-pressed');
    expect(document.activeElement).not.toBe(remind);
    expect(document.activeElement).not.toBe(decline);
    expect(optIn).not.toHaveBeenCalled();
    expect(snooze).not.toHaveBeenCalled();
  });

  it('"Remind me" opts in and shows the send weekday', async () => {
    renderPrompt();
    fireEvent.click(await screen.findByRole('button', { name: 'remind' }));
    expect(await screen.findByRole('status')).toHaveTextContent(`scheduled:${WEDNESDAY}`);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(optIn).toHaveBeenCalledTimes(1);
    expect(onOptIn).toHaveBeenCalledTimes(1);
  });

  it('"No thanks" snoozes and removes the prompt', async () => {
    const { container } = renderPrompt();
    fireEvent.click(await screen.findByRole('button', { name: 'decline' }));
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(snooze).toHaveBeenCalledTimes(1);
    expect(optIn).not.toHaveBeenCalled();
  });

  it('schedules this attempt for a learner already opted in, without the analytics event', async () => {
    loadStatus.mockResolvedValue({ ...OFFER, optedIn: true });
    renderPrompt();
    expect(await screen.findByRole('status')).toHaveTextContent(`scheduled:${WEDNESDAY}`);
    expect(optIn).toHaveBeenCalledTimes(1);
    expect(onOptIn).not.toHaveBeenCalled();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('says a review email is already coming when the weekly cap is used', async () => {
    loadStatus.mockResolvedValue({ ...OFFER, optedIn: true });
    optIn.mockResolvedValue({ status: 'capped', scheduledFor: null });
    renderPrompt();
    expect(await screen.findByRole('status')).toHaveTextContent('capped');
  });

  it.each([
    ['snoozed', { ...OFFER, snoozedUntil: '2026-11-16T10:00:00.000Z' }],
    ['not eligible', { ...OFFER, eligible: false }],
  ])('renders nothing when %s', async (_label, status) => {
    loadStatus.mockResolvedValue(status);
    const { container } = renderPrompt();
    await waitFor(() => expect(loadStatus).toHaveBeenCalled());
    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();
  });

  it.each(['remind', 'decline'])(
    'shows an inline error under the buttons when %s fails, buttons stay usable',
    async (name) => {
      optIn.mockRejectedValueOnce(new Error('boom'));
      snooze.mockRejectedValueOnce(new Error('boom'));
      renderPrompt();
      fireEvent.click(await screen.findByRole('button', { name }));
      expect(await screen.findByRole('status')).toHaveTextContent('saveError');
      const button = screen.getByRole('button', { name });
      expect(button).toHaveAttribute('aria-disabled', 'false');

      fireEvent.click(button);
      await waitFor(() => expect(screen.getByRole('status')).not.toHaveTextContent('saveError'));
    },
  );
});
