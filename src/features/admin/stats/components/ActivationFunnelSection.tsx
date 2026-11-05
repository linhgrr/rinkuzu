'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { fetchActivationFunnelViewModel } from '@/features/admin/stats/api/admin-stats-api';
import type {
  ActivationFunnelViewModel,
  ActivationFunnelWeekViewModel,
} from '@/features/admin/stats/types/admin-stats-view-model';

type TranslateFn = (key: string) => string;
type StepKey = 'signedIn' | 'startedQuiz' | 'activated' | 'returnedWeek1';

/** A settled request, tagged with the attempt it answers. `null` data is a failure. */
type Settled = { attempt: number; data: ActivationFunnelViewModel | null };

const STEPS: Array<{ key: StepKey; label: string }> = [
  { key: 'signedIn', label: 'activationFunnelSignedIn' },
  { key: 'startedQuiz', label: 'activationFunnelStartedQuiz' },
  { key: 'activated', label: 'activationFunnelActivated' },
  { key: 'returnedWeek1', label: 'activationFunnelReturnedWeek1' },
];

const DASH = '–';

function stepCell(count: number | null, signups: number): string {
  if (count === null) return DASH;
  const share = signups === 0 ? DASH : `${Math.round((count / signups) * 100)}%`;
  return `${count} (${share})`;
}

function FunnelRow({ week, t }: { week: ActivationFunnelWeekViewModel; t: TranslateFn }) {
  return (
    <tr className="border-t border-line">
      <th
        scope="row"
        className="sticky left-0 bg-white px-3 py-2 text-left font-medium whitespace-nowrap text-neutral-900"
      >
        <span>{week.isoWeek}</span>
        <span className="ml-2 text-xs font-normal text-neutral-500">{week.monday}</span>
        {week.inProgress ? (
          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            {t('activationFunnelInProgress')}
          </span>
        ) : null}
      </th>
      <td className="px-3 py-2 text-right tabular-nums">{week.signups}</td>
      {STEPS.map(({ key }) => (
        <td key={key} className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
          {stepCell(week[key], week.signups)}
        </td>
      ))}
    </tr>
  );
}

function FunnelTable({ funnel, t }: { funnel: ActivationFunnelViewModel; t: TranslateFn }) {
  return (
    <>
      {funnel.adaptiveAvailable ? null : (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t('activationFunnelAdaptiveUnavailable')}
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[640px] text-sm text-neutral-700">
          <thead className="bg-neutral-50 text-xs text-neutral-600">
            <tr>
              <th scope="col" className="sticky left-0 bg-neutral-50 px-3 py-2 text-left">
                {t('activationFunnelWeek')}
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                {t('activationFunnelSignups')}
              </th>
              {STEPS.map(({ key, label }) => (
                <th key={key} scope="col" className="px-3 py-2 text-right">
                  {t(label)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {funnel.weeks.map((week) => (
              <FunnelRow key={week.isoWeek} week={week} t={t} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-neutral-500">{t('activationFunnelCaption')}</p>
    </>
  );
}

/** Aggregate-only: signup-week counts, no learner ids or emails (RIN-935). */
export function ActivationFunnelSection() {
  const t = useTranslations('admin') as TranslateFn;
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled>({ attempt: -1, data: null });

  useEffect(() => {
    const controller = new AbortController();
    let superseded = false;
    fetchActivationFunnelViewModel(controller.signal)
      .then((data) => {
        if (!superseded) setSettled({ attempt, data });
      })
      .catch(() => {
        if (!superseded) setSettled({ attempt, data: null });
      });
    return () => {
      superseded = true;
      controller.abort();
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const loading = settled.attempt !== attempt;

  return (
    <Card className="p-0">
      <CardHeader>
        <CardTitle>{t('activationFunnelTitle')}</CardTitle>
        <CardDescription>{t('activationFunnelDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div
            className="h-64 w-full animate-pulse rounded-xl bg-neutral-100"
            role="status"
            aria-label={t('activationFunnelLoading')}
          />
        ) : settled.data ? (
          <FunnelTable funnel={settled.data} t={t} />
        ) : (
          <ErrorState message={t('activationFunnelError')} onRetry={retry} />
        )}
      </CardContent>
    </Card>
  );
}
