'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import type {
  ReviewEmailStatsViewModel,
  ReviewEmailWeekViewModel,
} from '@/features/admin/stats/types/review-email-view-model';
import { fetchReviewEmailStats } from '@/features/admin/stats/api/review-email-api';

type TranslateFn = (key: string) => string;

/** A settled request, tagged with the attempt it answers. `null` data is a failure. */
type Settled = { attempt: number; data: ReviewEmailStatsViewModel | null };

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function hasAnyCount(week: ReviewEmailWeekViewModel): boolean {
  return week.sent + (week.opened ?? 0) + week.unsubscribed + week.optIns > 0;
}

function ReviewEmailTable({ stats, t }: { stats: ReviewEmailStatsViewModel; t: TranslateFn }) {
  const newestFirst = [...stats.weeks].reverse();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[440px] text-sm">
        <thead>
          <tr className="text-left text-neutral-500">
            <th className="py-2">{t('reviewEmailWeek')}</th>
            <th className="py-2 text-right">{t('reviewEmailSent')}</th>
            <th className="py-2 text-right">{t('reviewEmailOpened')}</th>
            <th className="py-2 text-right">{t('reviewEmailUnsubscribed')}</th>
            <th className="py-2 text-right">{t('reviewEmailOptIns')}</th>
          </tr>
        </thead>
        <tbody>
          {newestFirst.map((week) => (
            <tr key={week.isoWeek} className="border-t border-line/50">
              <td className="py-2 font-medium">{week.isoWeek}</td>
              <td className="py-2 text-right tabular-nums">{week.sent.toLocaleString()}</td>
              <td className="py-2 text-right tabular-nums">
                {week.opened === null ? t('reviewEmailNotTracked') : week.opened.toLocaleString()}
              </td>
              <td className="py-2 text-right tabular-nums">{week.unsubscribed.toLocaleString()}</td>
              <td className="py-2 text-right tabular-nums">{week.optIns.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReviewEmailBody({ stats, t }: { stats: ReviewEmailStatsViewModel; t: TranslateFn }) {
  if (!stats.weeks.some(hasAnyCount)) {
    return <p className="py-2 text-sm text-neutral-500">{t('reviewEmailEmpty')}</p>;
  }
  return (
    <>
      <ReviewEmailTable stats={stats} t={t} />
      {stats.opensTracked ? null : (
        <p className="mt-3 text-xs text-neutral-500">{t('reviewEmailOpensNotTracked')}</p>
      )}
    </>
  );
}

/**
 * Week-1 review email panel (RIN-916): weekly sends, opens, unsubscribes and
 * opt-ins. Aggregate-only: nothing here identifies a learner or an email.
 */
export function ReviewEmailSection() {
  const t = useTranslations('admin') as TranslateFn;
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled>({ attempt: -1, data: null });

  useEffect(() => {
    const controller = new AbortController();
    // A superseded request must never write over the newer attempt.
    let superseded = false;
    fetchReviewEmailStats(controller.signal)
      .then((data) => {
        if (!superseded) setSettled({ attempt, data });
      })
      .catch((error: unknown) => {
        if (!superseded && !isAbort(error)) setSettled({ attempt, data: null });
      });
    return () => {
      superseded = true;
      controller.abort();
    };
  }, [attempt]);

  const loading = settled.attempt !== attempt;
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return (
    <Card className="p-0">
      <CardHeader>
        <CardTitle>{t('reviewEmailTitle')}</CardTitle>
        <CardDescription>{t('reviewEmailDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div
            className="h-40 w-full animate-pulse rounded-xl bg-neutral-100"
            role="status"
            aria-label={t('reviewEmailLoading')}
          />
        ) : settled.data ? (
          <ReviewEmailBody stats={settled.data} t={t} />
        ) : (
          <ErrorState message={t('reviewEmailError')} onRetry={retry} />
        )}
      </CardContent>
    </Card>
  );
}
