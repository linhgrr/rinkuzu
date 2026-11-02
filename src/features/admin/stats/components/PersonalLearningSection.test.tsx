import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchSummaryMock } = vi.hoisted(() => ({ fetchSummaryMock: vi.fn() }));

// Translation keys are the assertion surface here; the copy itself lives in
// messages/ and is covered by the i18n namespace gate.
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) =>
    values ? `${key}:${Object.values(values).join(',')}` : key,
}));
vi.mock('@/features/admin/stats/api/personal-learning-api', () => ({
  fetchPersonalLearningSummary: fetchSummaryMock,
}));
// The trend chart is a recharts island behind next/dynamic; its own rendering
// is not what this component is responsible for.
vi.mock('@/features/admin/stats/components/charts/PersonalLearningTrendChart', () => ({
  PersonalLearningTrendChart: () => <div data-testid="trend-chart" />,
}));

import { PersonalLearningSection } from './PersonalLearningSection';
import type { PersonalLearningSummaryViewModel } from '@/features/admin/stats/types/personal-learning-view-model';

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
      completedJobs: 4,
      failedJobs: 1,
      cancelledJobs: 0,
      activeJobs: 1,
      partialSuccesses: 2,
      retryableFailures: 1,
      successRate: 0.67,
      failureRate: 0.17,
      averageDurationSeconds: 12.5,
    },
    pipelineStatuses: [
      { key: 'completed', count: 4 },
      { key: 'failed', count: 1 },
    ],
    progressStatuses: [{ key: 'active', count: 3 }],
    topErrorCodes: [{ key: 'pdf_unreadable', count: 1 }],
    trend: [],
  };
}

describe('PersonalLearningSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchSummaryMock.mockResolvedValue(summary());
  });

  it('opens on the 30-day window and renders adoption, outcomes and pipeline health', async () => {
    render(<PersonalLearningSection />);

    expect(await screen.findByText('75%')).toBeInTheDocument();
    expect(fetchSummaryMock.mock.calls[0]?.[0]).toBe('30d');
    const learners = screen.getByText('personalLearningActiveLearners').parentElement;
    expect(learners).toHaveTextContent('4');
    expect(screen.getByText('67%')).toBeInTheDocument();
    expect(screen.getByText('pdf_unreadable')).toBeInTheDocument();
    expect(await screen.findByTestId('trend-chart')).toBeInTheDocument();
  });

  it('labels finished subjects and completed jobs as different counts', async () => {
    render(<PersonalLearningSection />);

    // subjects_completed is by completed_at; pipeline.completed_jobs by created_at.
    expect(
      await screen.findByText('personalLearningSubjectsCompletedDetail:5'),
    ).toBeInTheDocument();
    expect(screen.getByText('personalLearningJobsDetail:4,6')).toBeInTheDocument();
    // Both rates divide by every started job, still-running ones included.
    expect(screen.getAllByText('personalLearningRateHint')).toHaveLength(2);
    expect(screen.getByText('personalLearningCacheNote')).toBeInTheDocument();
  });

  it('shows a loading state first and an error state with retry when the summary fails', async () => {
    fetchSummaryMock.mockRejectedValueOnce(new Error('down'));
    render(<PersonalLearningSection />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'personalLearningLoading');

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('personalLearningSummaryError')).toBeInTheDocument();

    await userEvent.click(within(alert).getByRole('button'));
    await waitFor(() => expect(fetchSummaryMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('75%')).toBeInTheDocument();
  });

  it('refetches the summary when the time window changes', async () => {
    render(<PersonalLearningSection />);
    await screen.findByText('75%');

    const allTime = screen.getByRole('button', { name: 'personalLearningWindow_all' });
    await userEvent.click(allTime);

    await waitFor(() =>
      expect(fetchSummaryMock).toHaveBeenLastCalledWith('all', expect.anything()),
    );
    expect(allTime).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders no learner, subject or job controls', async () => {
    render(<PersonalLearningSection />);
    await screen.findByText('75%');

    expect(screen.queryByRole('search')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
