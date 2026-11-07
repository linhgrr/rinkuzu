import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ReviewEmailStatsViewModel,
  ReviewEmailWeekViewModel,
} from '@/features/admin/stats/types/review-email-view-model';

const { fetchStatsMock } = vi.hoisted(() => ({ fetchStatsMock: vi.fn() }));

// Translation keys are the assertion surface; the copy is covered by the i18n gate.
const translate = vi.hoisted(() => (key: string) => key);
vi.mock('next-intl', () => ({ useTranslations: () => translate }));
vi.mock('@/features/admin/stats/api/review-email-api', () => ({
  fetchReviewEmailStats: fetchStatsMock,
}));

import { ReviewEmailSection } from './ReviewEmailSection';

function week(isoWeek: string, counts: Partial<ReviewEmailWeekViewModel> = {}) {
  return {
    isoWeek,
    sent: 0,
    opened: 0,
    unsubscribed: 0,
    optIns: 0,
    ...counts,
  };
}

function stats(overrides: Partial<ReviewEmailStatsViewModel> = {}): ReviewEmailStatsViewModel {
  return {
    opensTracked: true,
    weeks: [
      week('2026-W44', { optIns: 3 }),
      week('2026-W45', { sent: 4, opened: 2, unsubscribed: 1, optIns: 5 }),
    ],
    ...overrides,
  };
}

function cells(row: HTMLElement | undefined): string[] {
  if (!row) throw new Error('row missing');
  return within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent ?? '');
}

describe('ReviewEmailSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a loading status, then one row per week, newest first', async () => {
    fetchStatsMock.mockResolvedValue(stats());

    render(<ReviewEmailSection />);

    expect(screen.getByRole('status', { name: 'reviewEmailLoading' })).toBeInTheDocument();
    const rows = within(await screen.findByRole('table')).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(cells(rows[1])).toEqual(['2026-W45', '4', '2', '1', '5']);
    expect(cells(rows[2])[0]).toBe('2026-W44');
    expect(screen.queryByText('reviewEmailOpensNotTracked')).not.toBeInTheDocument();
  });

  it('says opens are not tracked when open tracking is off', async () => {
    fetchStatsMock.mockResolvedValue(
      stats({ opensTracked: false, weeks: [week('2026-W45', { sent: 4, opened: null })] }),
    );

    render(<ReviewEmailSection />);

    expect(await screen.findByText('reviewEmailOpensNotTracked')).toBeInTheDocument();
    const [, row] = within(screen.getByRole('table')).getAllByRole('row');
    expect(cells(row)[2]).toBe('reviewEmailNotTracked');
  });

  it('shows the empty state when no week has any count', async () => {
    fetchStatsMock.mockResolvedValue(stats({ weeks: [week('2026-W44'), week('2026-W45')] }));

    render(<ReviewEmailSection />);

    expect(await screen.findByText('reviewEmailEmpty')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows an error with a retry that reloads the counts', async () => {
    fetchStatsMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(stats());

    render(<ReviewEmailSection />);

    expect(await screen.findByText('reviewEmailError')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button'));
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(fetchStatsMock).toHaveBeenCalledTimes(2);
  });
});
