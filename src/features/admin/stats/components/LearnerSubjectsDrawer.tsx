'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ErrorState } from '@/components/ui/ErrorState';
import { Modal } from '@/components/ui/Modal';
import { fetchLearnerSubjects } from '@/features/admin/stats/api/personal-learning-api';
import {
  formatDateTimeUtc,
  formatPercent,
} from '@/features/admin/stats/lib/personal-learning-format';
import type {
  LearnerIdentityViewModel,
  LearnerSubjectViewModel,
} from '@/features/admin/stats/types/personal-learning-view-model';

type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

interface LearnerSubjectsDrawerProps {
  learner: LearnerIdentityViewModel;
  onClose: () => void;
}

function SubjectsTable({ subjects, t }: { subjects: LearnerSubjectViewModel[]; t: TranslateFn }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full whitespace-nowrap text-sm">
        <caption className="sr-only">{t('learnerLookupSubjectsCaption')}</caption>
        <thead>
          <tr className="text-left text-neutral-500">
            <th className="py-2 pr-4">{t('learnerLookupFile')}</th>
            <th className="py-2 pr-4">{t('learnerLookupPipelineStatus')}</th>
            <th className="py-2 pr-4">{t('learnerLookupProgressStatus')}</th>
            <th className="py-2 pr-4 text-right">{t('personalLearningAccuracy')}</th>
            <th className="py-2 pr-4 text-right">{t('learnerLookupProgress')}</th>
            <th className="py-2 text-right">{t('learnerLookupLastActivity')}</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((subject) => (
            <tr key={subject.jobId} className="border-t border-line">
              <td className="max-w-xs truncate py-2 pr-4 font-medium">{subject.filename}</td>
              <td className="py-2 pr-4">{subject.pipelineStatus}</td>
              <td className="py-2 pr-4">{subject.progressStatus ?? '—'}</td>
              <td className="py-2 pr-4 text-right">{formatPercent(subject.accuracy)}</td>
              <td className="py-2 pr-4 text-right">{Math.round(subject.progressPercent)}%</td>
              <td className="py-2 text-right">{formatDateTimeUtc(subject.lastActivityAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Read-only drill-down. Every load is one audited view on the server. */
export function LearnerSubjectsDrawer({ learner, onClose }: LearnerSubjectsDrawerProps) {
  const t = useTranslations('admin') as TranslateFn;
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${learner.id}|${attempt}`;
  const [settled, setSettled] = useState<{
    key: string;
    subjects: LearnerSubjectViewModel[] | null;
  }>({ key: '', subjects: null });

  useEffect(() => {
    const controller = new AbortController();
    let superseded = false;
    fetchLearnerSubjects(learner.id, controller.signal)
      .then((subjects) => {
        if (!superseded) setSettled({ key: requestKey, subjects });
      })
      .catch((error: unknown) => {
        const aborted = error instanceof Error && error.name === 'AbortError';
        if (!superseded && !aborted) setSettled({ key: requestKey, subjects: null });
      });
    return () => {
      superseded = true;
      controller.abort();
    };
  }, [learner.id, requestKey]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const loading = settled.key !== requestKey;

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="wide"
      title={learner.displayName ? `${learner.displayName} · ${learner.email}` : learner.email}
      description={t('learnerLookupDrawerDescription')}
    >
      {loading ? (
        <div
          className="h-40 w-full animate-pulse rounded-xl bg-neutral-100"
          role="status"
          aria-label={t('learnerLookupLoadingSubjects')}
        />
      ) : settled.subjects === null ? (
        <ErrorState message={t('learnerLookupSubjectsError')} onRetry={retry} />
      ) : settled.subjects.length === 0 ? (
        <p className="text-sm text-neutral-500">{t('learnerLookupNoSubjects')}</p>
      ) : (
        <SubjectsTable subjects={settled.subjects} t={t} />
      )}
    </Modal>
  );
}
