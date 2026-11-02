'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { fetchPersonalLearningSummary } from '@/features/admin/stats/api/personal-learning-api';
import type {
  PersonalLearningSummaryViewModel,
  PersonalLearningWindow,
} from '@/features/admin/stats/types/personal-learning-view-model';
import { PersonalLearningSummaryPanels } from '@/features/admin/stats/components/PersonalLearningSummaryPanels';

type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

/** A settled request, tagged with the request it answers. `null` data is a failure. */
type Settled<T> = { key: string; data: T | null };

const WINDOWS: PersonalLearningWindow[] = ['7d', '30d', '90d', 'all'];

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function WindowFilter({
  window,
  onChange,
  t,
}: {
  window: PersonalLearningWindow;
  onChange: (next: PersonalLearningWindow) => void;
  t: TranslateFn;
}) {
  return (
    <div
      className="grid w-full grid-cols-4 gap-1 sm:flex sm:w-auto"
      role="group"
      aria-label={t('personalLearningWindowFilter')}
    >
      {WINDOWS.map((value) => (
        <Button
          key={value}
          type="button"
          size="sm"
          variant={window === value ? 'default' : 'outline'}
          aria-pressed={window === value}
          className="min-h-11 w-full px-3 text-sm font-semibold"
          onClick={() => onChange(value)}
        >
          {t(`personalLearningWindow_${value}`)}
        </Button>
      ))}
    </div>
  );
}

/** Aggregate-only: nothing in this section identifies a learner, subject or job. */
export function PersonalLearningSection() {
  const t = useTranslations('admin') as TranslateFn;
  const [window, setWindow] = useState<PersonalLearningWindow>('30d');
  const [attempt, setAttempt] = useState(0);
  const summaryKey = `${window}|${attempt}`;
  const [summaryState, setSummaryState] = useState<Settled<PersonalLearningSummaryViewModel>>({
    key: '',
    data: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    // A superseded request must never write: aborting does not stop a promise
    // that already resolved, and a late write would clobber the newer key and
    // leave the panel loading for good.
    let superseded = false;
    fetchPersonalLearningSummary(window, controller.signal)
      .then((data) => {
        if (!superseded) setSummaryState({ key: summaryKey, data });
      })
      .catch((error: unknown) => {
        if (!superseded && !isAbort(error)) setSummaryState({ key: summaryKey, data: null });
      });
    return () => {
      superseded = true;
      controller.abort();
    };
  }, [summaryKey, window]);

  const loading = summaryState.key !== summaryKey;
  const summary = loading ? null : summaryState.data;
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">
            {t('personalLearningWorkspaceTitle')}
          </h2>
          <p className="text-sm text-neutral-500">{t('personalLearningWorkspaceDescription')}</p>
          <p className="text-xs text-neutral-500">{t('personalLearningCacheNote')}</p>
        </div>
        <WindowFilter window={window} onChange={setWindow} t={t} />
      </div>

      {loading ? (
        <div
          className="h-64 w-full animate-pulse rounded-xl bg-neutral-100"
          role="status"
          aria-label={t('personalLearningLoading')}
        />
      ) : summary ? (
        <PersonalLearningSummaryPanels summary={summary} t={t} />
      ) : (
        <ErrorState message={t('personalLearningSummaryError')} onRetry={retry} />
      )}
    </section>
  );
}
