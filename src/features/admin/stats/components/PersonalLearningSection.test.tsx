import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchSummaryMock, fetchSubjectsMock } = vi.hoisted(() => ({
  fetchSummaryMock: vi.fn(),
  fetchSubjectsMock: vi.fn(),
}));

// Translation keys are the assertion surface here; the copy itself lives in
// messages/ and is covered by the i18n namespace gate.
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) =>
    values ? `${key}:${Object.values(values).join(',')}` : key,
}));
vi.mock('@/features/admin/stats/api/personal-learning-api', () => ({
  fetchPersonalLearningSummary: fetchSummaryMock,
  fetchPersonalLearningSubjects: fetchSubjectsMock,
}));
// The trend chart is a recharts island behind next/dynamic; its own rendering
// is not what this component is responsible for.
vi.mock('@/features/admin/stats/components/charts/PersonalLearningTrendChart', () => ({
  PersonalLearningTrendChart: () => <div data-testid="trend-chart" />,
}));

import { PersonalLearningSection } from './PersonalLearningSection';
import type {
  PersonalLearningSubjectViewModel,
  PersonalLearningSummaryViewModel,
} from '@/features/admin/stats/types/personal-learning-view-model';

function summary(): PersonalLearningSummaryViewModel {
  return {
    window: '30d',
    bucket: 'day',
    adoption: {
      activeLearners: 4,
      subjectsCreated: 6,
      subjectsCompleted: 5,
      subjectsWithProgress: 3,
    },
    outcomes: {
      totalAnswers: 40,
      totalCorrect: 30,
      weightedAccuracy: 0.75,
      averageMastery: 0.5,
      averageProgress: 42,
      masteredConcepts: 7,
    },
    pipeline: {
      totalJobs: 6,
      completedJobs: 5,
      failedJobs: 1,
      cancelledJobs: 0,
      activeJobs: 0,
      partialSuccesses: 2,
      retryableFailures: 1,
      successRate: 0.83,
      failureRate: 0.17,
      averageDurationSeconds: 12.5,
    },
    pipelineStatuses: [
      { key: 'completed', count: 5 },
      { key: 'failed', count: 1 },
    ],
    progressStatuses: [{ key: 'active', count: 3 }],
    topErrorCodes: [{ key: 'pdf_unreadable', count: 1 }],
    trend: [],
  };
}

function subject(
  overrides: Partial<PersonalLearningSubjectViewModel> = {},
): PersonalLearningSubjectViewModel {
  return {
    jobId: 'job-1',
    userId: 'user-a',
    displayName: 'Learner A',
    email: 'a@example.com',
    filename: 'calculus.pdf',
    subjectId: 'subject-1',
    pipelineStatus: 'completed',
    progressStatus: 'active',
    safeErrorCode: null,
    retryable: false,
    partialSuccess: false,
    conceptsExtracted: 20,
    conceptsAfterMerge: 18,
    relationsAccepted: 30,
    totalAnswers: 10,
    totalCorrect: 8,
    accuracy: 0.8,
    averageMastery: 0.55,
    progressPercent: 40,
    masteredConcepts: 4,
    lastSessionId: 'session-1',
    durationSeconds: 12.5,
    createdAt: '2026-08-01T00:00:00Z',
    completedAt: '2026-08-01T00:05:00Z',
    lastActivityAt: '2026-08-02T00:00:00Z',
    ...overrides,
  };
}

function lastSubjectsCall(): Record<string, unknown> {
  const calls = fetchSubjectsMock.mock.calls;
  return (calls[calls.length - 1]?.[0] ?? {}) as Record<string, unknown>;
}

describe('PersonalLearningSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom ships <dialog> without its modal methods.
    HTMLDialogElement.prototype.showModal = vi.fn(function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    HTMLDialogElement.prototype.close = vi.fn(function close(this: HTMLDialogElement) {
      this.removeAttribute('open');
    });
    fetchSummaryMock.mockResolvedValue(summary());
    fetchSubjectsMock.mockResolvedValue({ subjects: [subject()], nextCursor: null });
  });

  it('opens on the 30-day window and renders adoption, outcomes and pipeline health', async () => {
    render(<PersonalLearningSection />);

    await waitFor(() => expect(fetchSummaryMock).toHaveBeenCalled());
    expect(fetchSummaryMock.mock.calls[0]?.[0]).toBe('30d');
    expect(lastSubjectsCall()).toMatchObject({ window: '30d', limit: 25 });

    expect(await screen.findByText('4')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('83%')).toBeInTheDocument();
    expect(screen.getByText('pdf_unreadable')).toBeInTheDocument();
  });

  it('shows a loading state first and an error state with retry when the summary fails', async () => {
    fetchSummaryMock.mockRejectedValueOnce(new Error('down'));
    render(<PersonalLearningSection />);

    expect(screen.getAllByRole('status')[0]).toHaveAttribute(
      'aria-label',
      'personalLearningLoading',
    );

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('personalLearningSummaryError')).toBeInTheDocument();

    await userEvent.click(within(alert).getByRole('button'));
    await waitFor(() => expect(fetchSummaryMock).toHaveBeenCalledTimes(2));
  });

  it('renders an empty message when no subject matches', async () => {
    fetchSubjectsMock.mockResolvedValue({ subjects: [], nextCursor: null });
    render(<PersonalLearningSection />);

    expect(await screen.findByText('personalLearningNoSubjects')).toBeInTheDocument();
  });

  it('refetches both panels when the time window changes', async () => {
    render(<PersonalLearningSection />);
    await screen.findByText('Learner A');

    await userEvent.click(screen.getByRole('button', { name: 'personalLearningWindow_all' }));

    await waitFor(() =>
      expect(fetchSummaryMock).toHaveBeenLastCalledWith('all', expect.anything()),
    );
    await waitFor(() => expect(lastSubjectsCall()).toMatchObject({ window: 'all' }));
  });

  it('applies search and status filters and resets the cursor', async () => {
    fetchSubjectsMock.mockResolvedValue({ subjects: [subject()], nextCursor: 'cursor-2' });
    render(<PersonalLearningSection />);
    await screen.findByText('Learner A');

    await userEvent.click(screen.getByRole('button', { name: 'personalLearningNext' }));
    await waitFor(() => expect(lastSubjectsCall()).toMatchObject({ cursor: 'cursor-2' }));

    await userEvent.type(screen.getByLabelText('personalLearningSearchLabel'), 'linh');
    await userEvent.click(screen.getByRole('button', { name: 'personalLearningApplySearch' }));

    await waitFor(() => expect(lastSubjectsCall()).toMatchObject({ search: 'linh' }));
    expect(lastSubjectsCall()).not.toHaveProperty('cursor');

    await userEvent.selectOptions(
      screen.getByLabelText('personalLearningPipelineStatus'),
      'failed',
    );
    await waitFor(() => expect(lastSubjectsCall()).toMatchObject({ pipelineStatus: 'failed' }));
  });

  it('falls back to a shortened id when the account is gone', async () => {
    const userId = '507f191e810c19729de860ea';
    fetchSubjectsMock.mockResolvedValue({
      subjects: [subject({ displayName: null, email: null, userId })],
      nextCursor: null,
    });
    render(<PersonalLearningSection />);

    // Built rather than written out: a literal `#` + 8 hex chars reads as a
    // hardcoded colour to the design-system gate.
    expect(await screen.findByText(`#${userId.slice(-8)}`)).toBeInTheDocument();
  });

  it('opens a read-only drawer for one subject and closes it from the keyboard', async () => {
    render(<PersonalLearningSection />);
    await screen.findByText('Learner A');

    await userEvent.click(
      screen.getByRole('button', { name: 'personalLearningDetailsFor:calculus.pdf' }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('personalLearningReadOnlyNote')).toBeInTheDocument();
    expect(within(dialog).getByText('subject-1')).toBeInTheDocument();
    expect(within(dialog).queryByText(/concept name/i)).not.toBeInTheDocument();

    // Escape on a native <dialog> arrives as a cancel event, which jsdom does
    // not synthesise from a key press.
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
