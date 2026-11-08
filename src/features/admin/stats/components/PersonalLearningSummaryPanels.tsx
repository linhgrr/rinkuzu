'use client';

import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCount, formatPercent } from '@/features/admin/stats/lib/personal-learning-format';
import type {
  PersonalLearningBreakdownRowViewModel,
  PersonalLearningSummaryViewModel,
} from '@/features/admin/stats/types/personal-learning-view-model';

const PersonalLearningTrendChart = dynamic(
  () =>
    import('@/features/admin/stats/components/charts/PersonalLearningTrendChart').then(
      (module) => module.PersonalLearningTrendChart,
    ),
  {
    ssr: false,
    loading: () => <div className="h-72 w-full animate-pulse rounded bg-neutral-100" />,
  },
);

type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

function MetricCard({
  label,
  value,
  detail,
  hint,
}: {
  label: string;
  value: string;
  detail: string;
  /** How the number is computed, when the label alone could mislead. */
  hint?: string;
}) {
  return (
    <Card className="min-w-0 p-0">
      <CardContent className="p-4">
        <p className="truncate text-sm text-neutral-600">{label}</p>
        <p className="mt-2 break-words text-2xl font-semibold text-neutral-950">{value}</p>
        <p className="mt-1 text-xs text-neutral-500">{detail}</p>
        {hint ? <p className="mt-1 text-xs italic text-neutral-500">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function BreakdownList({
  rows,
  emptyLabel,
}: {
  rows: PersonalLearningBreakdownRowViewModel[];
  emptyLabel: string;
}) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (rows.length === 0) {
    return <p className="py-4 text-sm text-neutral-500">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="flex items-center justify-between text-sm">
            <span className="truncate text-neutral-700">{row.key}</span>
            <span className="ml-3 shrink-0 font-medium text-neutral-950">
              {formatCount(row.count)}
            </span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-warm">
            <div
              className="h-full rounded-full bg-brand-action"
              style={{ width: `${total > 0 ? Math.round((row.count / total) * 100) : 0}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function AdoptionCards({
  summary,
  t,
}: {
  summary: PersonalLearningSummaryViewModel;
  t: TranslateFn;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label={t('personalLearningActiveLearners')}
        value={formatCount(summary.adoption.activeLearners)}
        detail={t('personalLearningActiveLearnersDetail')}
      />
      <MetricCard
        label={t('personalLearningSubjectsCreated')}
        value={formatCount(summary.adoption.subjectsCreated)}
        detail={t('personalLearningSubjectsCompletedDetail', {
          count: summary.adoption.subjectsCompleted,
        })}
      />
      <MetricCard
        label={t('personalLearningAccuracy')}
        value={
          summary.outcomes.totalAnswers > 0 ? formatPercent(summary.outcomes.weightedAccuracy) : '—'
        }
        detail={t('personalLearningAnswersDetail', { count: summary.outcomes.totalAnswers })}
      />
      <MetricCard
        label={t('personalLearningMastery')}
        value={formatPercent(summary.outcomes.averageMastery)}
        detail={t('personalLearningMasteredConceptsDetail', {
          count: summary.outcomes.masteredConcepts,
        })}
      />
    </div>
  );
}

function PipelineHealthCards({
  summary,
  t,
}: {
  summary: PersonalLearningSummaryViewModel;
  t: TranslateFn;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label={t('personalLearningSuccessRate')}
        value={summary.pipeline.totalJobs > 0 ? formatPercent(summary.pipeline.successRate) : '—'}
        detail={t('personalLearningJobsDetail', {
          completed: summary.pipeline.completedJobs,
          total: summary.pipeline.totalJobs,
        })}
        hint={t('personalLearningRateHint')}
      />
      <MetricCard
        label={t('personalLearningFailureRate')}
        value={summary.pipeline.totalJobs > 0 ? formatPercent(summary.pipeline.failureRate) : '—'}
        detail={t('personalLearningRetryableDetail', { count: summary.pipeline.retryableFailures })}
        hint={t('personalLearningRateHint')}
      />
      <MetricCard
        label={t('personalLearningPartialSuccess')}
        value={formatCount(summary.pipeline.partialSuccesses)}
        detail={t('personalLearningActiveJobsDetail', { count: summary.pipeline.activeJobs })}
      />
      <MetricCard
        label={t('personalLearningAverageDuration')}
        value={
          summary.pipeline.averageDurationSeconds > 0
            ? t('personalLearningSeconds', {
                value: Math.round(summary.pipeline.averageDurationSeconds),
              })
            : '—'
        }
        detail={t('personalLearningProgressDetail', {
          count: summary.adoption.subjectsWithProgress,
        })}
      />
    </div>
  );
}

export function PersonalLearningSummaryPanels({
  summary,
  t,
}: {
  summary: PersonalLearningSummaryViewModel;
  t: TranslateFn;
}) {
  const distributions: Array<[string, PersonalLearningBreakdownRowViewModel[]]> = [
    [t('personalLearningPipelineStatuses'), summary.pipelineStatuses],
    [t('personalLearningProgressStatuses'), summary.progressStatuses],
    [t('personalLearningTopErrors'), summary.topErrorCodes],
  ];

  return (
    <>
      <AdoptionCards summary={summary} t={t} />
      <PipelineHealthCards summary={summary} t={t} />

      <Card className="p-0">
        <CardHeader>
          <CardTitle>{t('personalLearningTrendTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <PersonalLearningTrendChart
            data={summary.trend}
            labels={{
              chart: t('personalLearningTrendTitle'),
              created: t('personalLearningSubjectsCreated'),
              completed: t('personalLearningJobsCompleted'),
              failed: t('personalLearningJobsFailed'),
              learners: t('personalLearningActiveLearners'),
              empty: t('personalLearningEmpty'),
            }}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {distributions.map(([title, rows]) => (
          <Card key={title} className="p-0">
            <CardHeader>
              <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <BreakdownList rows={rows} emptyLabel={t('personalLearningEmpty')} />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
