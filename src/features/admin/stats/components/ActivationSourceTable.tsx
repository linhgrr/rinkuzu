'use client';

import { useCallback, useEffect, useState } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';
import { fetchActivationSourceRows } from '@/features/admin/stats/api/admin-stats-api';
import type { ActivationSourceRowViewModel } from '@/features/admin/stats/types/admin-stats-view-model';

type TranslateFn = (key: string) => string;

/** A settled request, tagged with the attempt it answers. `null` rows is a failure. */
type Settled = { attempt: number; rows: ActivationSourceRowViewModel[] | null };

/** The catch-all keys have a translated label; every other key is a channel name shown as is. */
const LABELLED_SOURCES = new Set(['unknown', 'other']);

function sourceLabel(source: string, t: TranslateFn): string {
  return LABELLED_SOURCES.has(source) ? t(`activationSourceKey_${source}`) : source;
}

function SourceRow({
  row,
  firstOfWeek,
  t,
}: {
  row: ActivationSourceRowViewModel;
  firstOfWeek: boolean;
  t: TranslateFn;
}) {
  return (
    <tr className={firstOfWeek ? 'border-t border-line' : ''}>
      <th
        scope="row"
        className="sticky left-0 bg-white px-3 py-2 text-left font-medium whitespace-nowrap text-neutral-900"
      >
        {/* Later rows of a week keep the label for screen readers only. */}
        <span className={firstOfWeek ? 'block' : 'sr-only'}>{row.isoWeek}</span>
        {firstOfWeek ? (
          <span className="block text-xs font-normal text-neutral-500">{row.monday}</span>
        ) : null}
        {firstOfWeek && row.inProgress ? (
          <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            {t('activationFunnelInProgress')}
          </span>
        ) : null}
      </th>
      <td className="px-3 py-2 text-left whitespace-nowrap text-neutral-900">
        {sourceLabel(row.source, t)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{row.signups}</td>
      <td className="px-3 py-2 text-right tabular-nums">{row.startedQuiz}</td>
      <td className="px-3 py-2 text-right tabular-nums">{row.activated}</td>
    </tr>
  );
}

function SourceTable({ rows, t }: { rows: ActivationSourceRowViewModel[]; t: TranslateFn }) {
  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table
          aria-label={t('activationSourceTableLabel')}
          className="w-full min-w-[480px] text-sm text-neutral-700"
        >
          <thead className="bg-neutral-50 text-xs text-neutral-600">
            <tr>
              <th scope="col" className="sticky left-0 bg-neutral-50 px-3 py-2 text-left">
                {t('activationFunnelWeek')}
              </th>
              <th scope="col" className="px-3 py-2 text-left">
                {t('activationSourceColumn')}
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                {t('activationFunnelSignups')}
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                {t('activationFunnelStartedQuiz')}
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                {t('activationFunnelActivated')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <SourceRow
                key={`${row.isoWeek}:${row.source}`}
                row={row}
                firstOfWeek={rows[index - 1]?.isoWeek !== row.isoWeek}
                t={t}
              />
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-neutral-500">{t('activationSourceCaption')}</p>
    </>
  );
}

/**
 * Signups, started-quiz and activated learners by first-touch source (RIN-1761).
 * It loads on its own, so a failure here never hides the funnel table above it.
 */
export function ActivationSourceTable({ t }: { t: TranslateFn }) {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled>({ attempt: -1, rows: null });

  useEffect(() => {
    const controller = new AbortController();
    let superseded = false;
    fetchActivationSourceRows(controller.signal)
      .then((rows) => {
        if (!superseded) setSettled({ attempt, rows });
      })
      .catch(() => {
        if (!superseded) setSettled({ attempt, rows: null });
      });
    return () => {
      superseded = true;
      controller.abort();
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const loading = settled.attempt !== attempt;

  return (
    <section className="mt-6" aria-labelledby="activation-source-title">
      <h3 id="activation-source-title" className="mb-2 text-sm font-semibold text-neutral-900">
        {t('activationSourceTitle')}
      </h3>
      {loading ? (
        <div
          className="h-48 w-full animate-pulse rounded-lg bg-neutral-100"
          role="status"
          aria-label={t('activationSourceLoading')}
        />
      ) : settled.rows === null ? (
        <ErrorState message={t('activationSourceError')} onRetry={retry} />
      ) : settled.rows.length === 0 ? (
        <p className="rounded-lg border border-line bg-neutral-50 px-3 py-4 text-sm text-neutral-600">
          {t('activationSourceEmpty')}
        </p>
      ) : (
        <SourceTable rows={settled.rows} t={t} />
      )}
    </section>
  );
}
