import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActivationFunnelViewModel } from '@/features/admin/stats/types/admin-stats-view-model';

const { fetchFunnelMock } = vi.hoisted(() => ({ fetchFunnelMock: vi.fn() }));

// Keys are the assertion surface; copy lives in messages/.
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/features/admin/stats/api/admin-stats-api', () => ({
  fetchActivationFunnelViewModel: fetchFunnelMock,
}));

import { ActivationFunnelSection } from './ActivationFunnelSection';

function funnel(overrides: Partial<ActivationFunnelViewModel> = {}): ActivationFunnelViewModel {
  return {
    adaptiveAvailable: true,
    weeks: [
      {
        isoWeek: '2026-W45',
        monday: '2026-11-02',
        signups: 18,
        signedIn: 12,
        startedQuiz: 9,
        activated: 6,
        returnedWeek1: null,
        inProgress: true,
      },
      {
        isoWeek: '2026-W44',
        monday: '2026-10-26',
        signups: 0,
        signedIn: 0,
        startedQuiz: 0,
        activated: 0,
        returnedWeek1: 0,
        inProgress: false,
      },
      {
        isoWeek: '2026-W43',
        monday: '2026-10-19',
        signups: 3,
        signedIn: 3,
        startedQuiz: 2,
        activated: 1,
        returnedWeek1: 1,
        inProgress: false,
      },
    ],
    ...overrides,
  };
}

function rowFor(isoWeek: string): HTMLElement {
  const row = screen.getByText(isoWeek).closest('tr');
  if (!row) throw new Error(`no row for ${isoWeek}`);
  return row;
}

function cellTexts(row: HTMLElement): string[] {
  return within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent ?? '');
}

describe('ActivationFunnelSection', () => {
  beforeEach(() => {
    fetchFunnelMock.mockReset();
    fetchFunnelMock.mockResolvedValue(funnel());
  });

  it('renders each step as a count with its whole-percent share of signups', async () => {
    render(<ActivationFunnelSection />);
    await screen.findByRole('table');

    expect(cellTexts(rowFor('2026-W45'))).toEqual(['18', '12 (67%)', '9 (50%)', '6 (33%)', '–']);
    expect(cellTexts(rowFor('2026-W43'))).toEqual([
      '3',
      '3 (100%)',
      '2 (67%)',
      '1 (33%)',
      '1 (33%)',
    ]);
    expect(screen.getByText('activationFunnelCaption')).toBeInTheDocument();
  });

  it('shows – for the share when a week has no signups', async () => {
    render(<ActivationFunnelSection />);
    await screen.findByRole('table');

    expect(cellTexts(rowFor('2026-W44'))).toEqual(['0', '0 (–)', '0 (–)', '0 (–)', '0 (–)']);
  });

  it('tags only the current week as in progress, newest week first', async () => {
    render(<ActivationFunnelSection />);
    await screen.findByRole('table');

    expect(within(rowFor('2026-W45')).getByText('activationFunnelInProgress')).toBeInTheDocument();
    expect(screen.getAllByText('activationFunnelInProgress')).toHaveLength(1);
    const weeks = screen.getAllByRole('rowheader').map((cell) => cell.textContent);
    expect(weeks[0]).toContain('2026-11-02');
  });

  it('notes quiz-only counts when adaptive data is unavailable', async () => {
    fetchFunnelMock.mockResolvedValue(funnel({ adaptiveAvailable: false }));
    render(<ActivationFunnelSection />);
    await screen.findByRole('table');

    expect(screen.getByText('activationFunnelAdaptiveUnavailable')).toBeInTheDocument();
  });

  it('shows a loading state, then an inline error with a working retry', async () => {
    fetchFunnelMock.mockRejectedValueOnce(new Error('down'));
    render(<ActivationFunnelSection />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'activationFunnelLoading');
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('activationFunnelError')).toBeInTheDocument();
    expect(screen.queryByText('activationFunnelAdaptiveUnavailable')).not.toBeInTheDocument();

    await userEvent.click(within(alert).getByRole('button'));
    await waitFor(() => expect(fetchFunnelMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });
});
