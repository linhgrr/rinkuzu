'use client';

import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  fetchPersonalLearningSubjects,
  fetchPersonalLearningSummary,
} from '@/features/admin/stats/api/personal-learning-api';
import type {
  PersonalLearningSubjectViewModel,
  PersonalLearningSubjectsViewModel,
  PersonalLearningSummaryViewModel,
  PersonalLearningWindow,
} from '@/features/admin/stats/types/personal-learning-view-model';
import { PersonalLearningSummaryPanels } from '@/features/admin/stats/components/PersonalLearningSummaryPanels';
import { PersonalLearningSubjectsTable } from '@/features/admin/stats/components/PersonalLearningSubjectsTable';
import { PersonalLearningSubjectDrawer } from '@/features/admin/stats/components/PersonalLearningSubjectDrawer';

type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

/** A settled request, tagged with the request it answers. `null` data is a failure. */
type Settled<T> = { key: string; data: T | null };

const WINDOWS: PersonalLearningWindow[] = ['7d', '30d', '90d', 'all'];
const PAGE_SIZE = 25;

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

function LoadingPanel({ label, className }: { label: string; className: string }) {
  return (
    <div
      className={`w-full animate-pulse rounded-xl bg-neutral-100 ${className}`}
      role="status"
      aria-label={label}
    />
  );
}

export function PersonalLearningSection() {
  const t = useTranslations('admin') as TranslateFn;
  const [window, setWindow] = useState<PersonalLearningWindow>('30d');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [pipelineStatus, setPipelineStatus] = useState('');
  const [progressStatus, setProgressStatus] = useState('');
  const [cursors, setCursors] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<PersonalLearningSubjectViewModel | null>(null);

  const cursor = cursors.at(-1);
  const summaryKey = `${window}|${attempt}`;
  // JSON, not join('|'): a search term containing the separator could otherwise
  // collide with a different filter combination and skip the refetch.
  const subjectsKey = JSON.stringify([
    window,
    search,
    pipelineStatus,
    progressStatus,
    cursor,
    attempt,
  ]);

  const [summaryState, setSummaryState] = useState<Settled<PersonalLearningSummaryViewModel>>({
    key: '',
    data: null,
  });
  const [subjectsState, setSubjectsState] = useState<Settled<PersonalLearningSubjectsViewModel>>({
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

  useEffect(() => {
    const controller = new AbortController();
    let superseded = false;
    fetchPersonalLearningSubjects(
      {
        window,
        limit: PAGE_SIZE,
        ...(search ? { search } : {}),
        ...(pipelineStatus ? { pipelineStatus } : {}),
        ...(progressStatus ? { progressStatus } : {}),
        ...(cursor ? { cursor } : {}),
      },
      controller.signal,
    )
      .then((data) => {
        if (!superseded) setSubjectsState({ key: subjectsKey, data });
      })
      .catch((error: unknown) => {
        if (!superseded && !isAbort(error)) setSubjectsState({ key: subjectsKey, data: null });
      });
    return () => {
      superseded = true;
      controller.abort();
    };
    // subjectsKey is the digest of every filter the request is built from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectsKey]);

  const summaryLoading = summaryState.key !== summaryKey;
  const summary = summaryLoading ? null : summaryState.data;
  const subjectsLoading = subjectsState.key !== subjectsKey;
  const page = subjectsLoading ? null : subjectsState.data;

  const pipelineStatusOptions = useMemo(
    () => summary?.pipelineStatuses.map((row) => row.key) ?? [],
    [summary],
  );
  const progressStatusOptions = useMemo(
    () => summary?.progressStatuses.map((row) => row.key) ?? [],
    [summary],
  );

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const resetPaging = () => setCursors([]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    resetPaging();
    setSearch(searchInput.trim());
  };

  const changeWindow = (next: PersonalLearningWindow) => {
    if (next === window) return;
    resetPaging();
    setWindow(next);
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">
            {t('personalLearningWorkspaceTitle')}
          </h2>
          <p className="text-sm text-neutral-500">{t('personalLearningWorkspaceDescription')}</p>
        </div>
        <WindowFilter window={window} onChange={changeWindow} t={t} />
      </div>

      {summaryLoading ? (
        <LoadingPanel label={t('personalLearningLoading')} className="h-64" />
      ) : summary ? (
        <PersonalLearningSummaryPanels summary={summary} t={t} />
      ) : (
        <ErrorState message={t('personalLearningSummaryError')} onRetry={retry} />
      )}

      <Card className="p-0">
        <CardHeader className="gap-3">
          <CardTitle>{t('personalLearningSubjectsTitle')}</CardTitle>
          <form
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            onSubmit={submitSearch}
            role="search"
            aria-label={t('personalLearningSubjectsTitle')}
          >
            <Input
              inputSize="sm"
              label={t('personalLearningSearchLabel')}
              placeholder={t('personalLearningSearchPlaceholder')}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            <Select
              selectSize="sm"
              label={t('personalLearningPipelineStatus')}
              value={pipelineStatus}
              onChange={(event) => {
                resetPaging();
                setPipelineStatus(event.target.value);
              }}
            >
              <option value="">{t('personalLearningAllStatuses')}</option>
              {pipelineStatusOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
            <Select
              selectSize="sm"
              label={t('personalLearningProgressStatus')}
              value={progressStatus}
              onChange={(event) => {
                resetPaging();
                setProgressStatus(event.target.value);
              }}
            >
              <option value="">{t('personalLearningAllStatuses')}</option>
              {progressStatusOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
            <div className="flex items-end">
              <Button type="submit" size="sm" className="min-h-11 w-full">
                {t('personalLearningApplySearch')}
              </Button>
            </div>
          </form>
        </CardHeader>
        <CardContent>
          {subjectsLoading ? (
            <LoadingPanel label={t('personalLearningLoading')} className="h-48" />
          ) : !page ? (
            <ErrorState message={t('personalLearningSubjectsError')} onRetry={retry} />
          ) : page.subjects.length === 0 ? (
            <p className="py-6 text-sm text-neutral-500">{t('personalLearningNoSubjects')}</p>
          ) : (
            <PersonalLearningSubjectsTable subjects={page.subjects} onSelect={setSelected} t={t} />
          )}

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={cursors.length === 0}
              onClick={() => setCursors((stack) => stack.slice(0, -1))}
            >
              {t('personalLearningPrevious')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!page?.nextCursor}
              onClick={() =>
                setCursors((stack) => (page?.nextCursor ? [...stack, page.nextCursor] : stack))
              }
            >
              {t('personalLearningNext')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <PersonalLearningSubjectDrawer subject={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
