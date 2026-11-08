'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { searchLearners } from '@/features/admin/stats/api/personal-learning-api';
import { LearnerSubjectsDrawer } from '@/features/admin/stats/components/LearnerSubjectsDrawer';
import type { LearnerIdentityViewModel } from '@/features/admin/stats/types/personal-learning-view-model';

type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

/** One submitted search; `id` changes on every submit so a retry refetches. */
type SearchRequest = { query: string; id: number };

const MIN_QUERY_LENGTH = 2;

function LearnersTable({
  learners,
  onSelect,
  t,
}: {
  learners: LearnerIdentityViewModel[];
  onSelect: (learner: LearnerIdentityViewModel) => void;
  t: TranslateFn;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{t('learnerLookupResultsCaption')}</caption>
        <thead>
          <tr className="text-left text-neutral-500">
            <th className="py-2 pr-4">{t('learnerLookupName')}</th>
            <th className="py-2 pr-4">{t('learnerLookupEmail')}</th>
            <th className="py-2 text-right">
              <span className="sr-only">{t('learnerLookupView')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {learners.map((learner) => (
            <tr key={learner.id} className="border-t border-line">
              <td className="py-2 pr-4 font-medium">{learner.displayName ?? '—'}</td>
              <td className="break-all py-2 pr-4">{learner.email}</td>
              <td className="py-2 text-right">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label={t('learnerLookupViewFor', { email: learner.email })}
                  onClick={() => onSelect(learner)}
                >
                  {t('learnerLookupView')}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Find one learner by name or email, then open their read-only drill-down. */
export function LearnerLookupSection() {
  const t = useTranslations('admin') as TranslateFn;
  const [draft, setDraft] = useState('');
  const [request, setRequest] = useState<SearchRequest | null>(null);
  const [settled, setSettled] = useState<{
    id: number;
    learners: LearnerIdentityViewModel[] | null;
  }>({ id: 0, learners: null });
  const [selected, setSelected] = useState<LearnerIdentityViewModel | null>(null);

  useEffect(() => {
    if (!request) return;
    const controller = new AbortController();
    let superseded = false;
    searchLearners(request.query, controller.signal)
      .then((learners) => {
        if (!superseded) setSettled({ id: request.id, learners });
      })
      .catch((error: unknown) => {
        const aborted = error instanceof Error && error.name === 'AbortError';
        if (!superseded && !aborted) setSettled({ id: request.id, learners: null });
      });
    return () => {
      superseded = true;
      controller.abort();
    };
  }, [request]);

  const query = draft.trim();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (query.length >= MIN_QUERY_LENGTH) setRequest({ query, id: (request?.id ?? 0) + 1 });
  };
  const retry = useCallback(
    () => setRequest((current) => (current ? { ...current, id: current.id + 1 } : current)),
    [],
  );
  const loading = request !== null && settled.id !== request.id;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">{t('learnerLookupTitle')}</h2>
        <p className="text-sm text-neutral-500">{t('learnerLookupDescription')}</p>
      </div>
      <form className="flex max-w-xl items-end gap-2" role="search" onSubmit={submit}>
        <div className="flex-1">
          <Input
            type="search"
            label={t('learnerLookupSearchLabel')}
            value={draft}
            maxLength={100}
            onChange={(event) => setDraft(event.target.value)}
          />
        </div>
        <Button type="submit" disabled={query.length < MIN_QUERY_LENGTH} className="min-h-11">
          {t('learnerLookupSearch')}
        </Button>
      </form>

      {request === null ? null : loading ? (
        <div
          className="h-24 w-full animate-pulse rounded-xl bg-neutral-100"
          role="status"
          aria-label={t('learnerLookupSearching')}
        />
      ) : settled.learners === null ? (
        <ErrorState message={t('learnerLookupSearchError')} onRetry={retry} />
      ) : settled.learners.length === 0 ? (
        <p className="text-sm text-neutral-500">
          {t('learnerLookupNoResults', { query: request.query })}
        </p>
      ) : (
        <LearnersTable learners={settled.learners} onSelect={setSelected} t={t} />
      )}

      {selected ? (
        <LearnerSubjectsDrawer
          key={selected.id}
          learner={selected}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </section>
  );
}
