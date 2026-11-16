import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ActivationEmailWeekViewModel,
  ActivationFunnelViewModel,
  ActivationSourceRowViewModel,
} from '@/features/admin/stats/types/admin-stats-view-model';

const { fetchFunnelMock, fetchSourceMock } = vi.hoisted(() => ({
  fetchFunnelMock: vi.fn(),
  fetchSourceMock: vi.fn(),
}));

// Keys are the assertion surface; copy lives in messages/.
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/features/admin/stats/api/admin-stats-api', () => ({
  fetchActivationFunnelViewModel: fetchFunnelMock,
  fetchActivationSourceRows: fetchSourceMock,
}));

import { ActivationFunnelSection } from './ActivationFunnelSection';

function emailWeek(
  isoWeek: string,
  monday: string,
  counts: Partial<ActivationEmailWeekViewModel> = {},
): ActivationEmailWeekViewModel {
  return {
    isoWeek,
    monday,
    sent: 0,
    sentDay1: 0,
    sentBackfill: 0,
    clicked: 0,
    activatedWithin7d: 0,
    inProgress: false,
    ...counts,
  };
}

function funnel(overrides: Partial<ActivationFunnelViewModel> = {}): ActivationFunnelViewModel {
  return {
    adaptiveAvailable: true,
    uploadWeeks: [],
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
    emailWeeks: [
      emailWeek('2026-W45', '2026-11-02', { sent: 0, inProgress: true }),
      emailWeek('2026-W44', '2026-10-26', {
        sent: 5,
        sentDay1: 4,
        sentBackfill: 1,
        clicked: 1,
        activatedWithin7d: 2,
      }),
    ],
    ...overrides,
  };
}

function sourceRow(
  isoWeek: string,
  source: string,
  counts: Partial<ActivationSourceRowViewModel> = {},
): ActivationSourceRowViewModel {
  return {
    isoWeek,
    monday: isoWeek === '2026-W45' ? '2026-11-02' : '2026-10-26',
    source,
    signups: 1,
    startedQuiz: 0,
    activated: 0,
    inProgress: isoWeek === '2026-W45',
    ...counts,
  };
}

const SOURCE_TABLE = { name: 'activationSourceTableLabel' };
const FUNNEL_TABLE = { name: 'activationFunnelTableLabel' };
const EMAIL_TABLE = { name: 'activationEmailTableLabel' };

function rowFor(isoWeek: string, table = FUNNEL_TABLE): HTMLElement {
  const row = within(screen.getByRole('table', table)).getByText(isoWeek).closest('tr');
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
    fetchSourceMock.mockReset();
    fetchSourceMock.mockResolvedValue([
      sourceRow('2026-W45', 'google', { signups: 7, startedQuiz: 4, activated: 2 }),
      sourceRow('2026-W45', 'facebook', { signups: 3, startedQuiz: 1, activated: 0 }),
      sourceRow('2026-W45', 'unknown', { signups: 5, startedQuiz: 2, activated: 1 }),
      sourceRow('2026-W45', 'other', { signups: 1 }),
      sourceRow('2026-W44', 'search', { signups: 2, startedQuiz: 2, activated: 1 }),
    ]);
  });

  it('renders each step as a count with its whole-percent share of signups', async () => {
    render(<ActivationFunnelSection />);
    await screen.findByRole('table', FUNNEL_TABLE);

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
    await screen.findByRole('table', FUNNEL_TABLE);

    expect(cellTexts(rowFor('2026-W44'))).toEqual(['0', '0 (–)', '0 (–)', '0 (–)', '0 (–)']);
  });

  it('tags only the current week as in progress, newest week first', async () => {
    render(<ActivationFunnelSection />);
    await screen.findByRole('table', FUNNEL_TABLE);

    expect(within(rowFor('2026-W45')).getByText('activationFunnelInProgress')).toBeInTheDocument();
    const funnelTable = screen.getByRole('table', FUNNEL_TABLE);
    expect(within(funnelTable).getAllByText('activationFunnelInProgress')).toHaveLength(1);
    const weeks = within(funnelTable)
      .getAllByRole('rowheader')
      .map((cell) => cell.textContent);
    expect(weeks[0]).toContain('2026-11-02');
  });

  it('notes quiz-only counts when adaptive data is unavailable', async () => {
    fetchFunnelMock.mockResolvedValue(funnel({ adaptiveAvailable: false }));
    render(<ActivationFunnelSection />);
    await screen.findByRole('table', FUNNEL_TABLE);

    expect(screen.getByText('activationFunnelAdaptiveUnavailable')).toBeInTheDocument();
  });

  it('shows a loading state, then an inline error with a working retry', async () => {
    fetchFunnelMock.mockRejectedValueOnce(new Error('down'));
    render(<ActivationFunnelSection />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'activationFunnelLoading');
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('activationFunnelError')).toBeInTheDocument();
    expect(screen.queryByText('activationFunnelAdaptiveUnavailable')).not.toBeInTheDocument();
    expect(screen.queryByText('activationEmailTitle')).not.toBeInTheDocument();

    await userEvent.click(within(alert).getByRole('button'));
    await waitFor(() => expect(fetchFunnelMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('table', FUNNEL_TABLE)).toBeInTheDocument();
  });

  it('shows activation-email sends per send week with shares of sent (RIN-1001)', async () => {
    render(<ActivationFunnelSection />);
    await screen.findByRole('table', EMAIL_TABLE);

    expect(screen.getByText('activationEmailTitle')).toBeInTheDocument();
    expect(cellTexts(rowFor('2026-W44', EMAIL_TABLE))).toEqual([
      '5',
      '4',
      '1',
      '1 (20%)',
      '2 (40%)',
    ]);
    expect(cellTexts(rowFor('2026-W45', EMAIL_TABLE))).toEqual(['0', '0', '0', '0 (–)', '0 (–)']);
    expect(
      within(rowFor('2026-W45', EMAIL_TABLE)).getByText('activationFunnelInProgress'),
    ).toBeInTheDocument();
    expect(screen.getByText('activationEmailCaption')).toBeInTheDocument();
    expect(screen.queryByText('activationEmailEmpty')).not.toBeInTheDocument();
  });

  it('shows an empty state instead of a table of zeros when no email was sent', async () => {
    fetchFunnelMock.mockResolvedValue(
      funnel({
        emailWeeks: [emailWeek('2026-W45', '2026-11-02'), emailWeek('2026-W44', '2026-10-26')],
      }),
    );
    render(<ActivationFunnelSection />);
    await screen.findByRole('table', FUNNEL_TABLE);

    expect(screen.getByText('activationEmailEmpty')).toBeInTheDocument();
    expect(screen.queryByRole('table', EMAIL_TABLE)).not.toBeInTheDocument();
  });

  it('lists signups, started quiz and activated per week and source, catch-alls last (RIN-1761)', async () => {
    render(<ActivationFunnelSection />);
    const table = await screen.findByRole('table', SOURCE_TABLE);

    expect(screen.getByText('activationSourceTitle')).toBeInTheDocument();
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => cellTexts(row))).toEqual([
      ['google', '7', '4', '2'],
      ['facebook', '3', '1', '0'],
      ['activationSourceKey_unknown', '5', '2', '1'],
      ['activationSourceKey_other', '1', '0', '0'],
      ['search', '2', '2', '1'],
    ]);
    expect(within(rows[0] as HTMLElement).getByText('2026-W45')).toBeVisible();
    expect(within(rows[0] as HTMLElement).getByText('activationFunnelInProgress')).toBeVisible();
    expect(within(rows[4] as HTMLElement).queryByText('activationFunnelInProgress')).toBeNull();
  });

  it('shows the empty line when no source has signups', async () => {
    fetchSourceMock.mockResolvedValue([]);
    render(<ActivationFunnelSection />);

    expect(await screen.findByText('activationSourceEmpty')).toBeInTheDocument();
    expect(screen.queryByRole('table', SOURCE_TABLE)).not.toBeInTheDocument();
  });

  it('keeps the funnel table when the source call fails and retries on request', async () => {
    fetchSourceMock.mockRejectedValueOnce(new Error('down'));
    render(<ActivationFunnelSection />);

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('activationSourceError')).toBeInTheDocument();
    expect(screen.getByRole('table', FUNNEL_TABLE)).toBeInTheDocument();
    expect(screen.getByText('activationEmailTitle')).toBeInTheDocument();

    await userEvent.click(within(alert).getByRole('button'));
    expect(await screen.findByRole('table', SOURCE_TABLE)).toBeInTheDocument();
    expect(fetchSourceMock).toHaveBeenCalledTimes(2);
  });

  it('shows a skeleton while the source call is pending', async () => {
    fetchSourceMock.mockReturnValue(new Promise(() => {}));
    render(<ActivationFunnelSection />);

    await screen.findByRole('table', FUNNEL_TABLE);
    expect(screen.getByRole('status', { name: 'activationSourceLoading' })).toBeInTheDocument();
  });
});
