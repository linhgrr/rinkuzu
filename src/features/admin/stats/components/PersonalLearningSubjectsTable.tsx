'use client';

import { Button } from '@/components/ui/Button';
import {
  formatDateTime,
  formatPercent,
  learnerLabel,
} from '@/features/admin/stats/lib/personal-learning-format';
import type { PersonalLearningSubjectViewModel } from '@/features/admin/stats/types/personal-learning-view-model';

type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

interface PersonalLearningSubjectsTableProps {
  subjects: PersonalLearningSubjectViewModel[];
  onSelect: (subject: PersonalLearningSubjectViewModel) => void;
  t: TranslateFn;
}

export function PersonalLearningSubjectsTable({
  subjects,
  onSelect,
  t,
}: PersonalLearningSubjectsTableProps) {
  const columns = [
    t('personalLearningLearner'),
    t('personalLearningSubject'),
    t('personalLearningPipelineStatus'),
    t('personalLearningProgressStatus'),
  ];
  const numericColumns = [
    t('personalLearningAnswers'),
    t('personalLearningAccuracy'),
    t('personalLearningProgress'),
    t('personalLearningLastActivity'),
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full whitespace-nowrap text-sm">
        <caption className="sr-only">{t('personalLearningSubjectsTitle')}</caption>
        <thead>
          <tr className="text-left text-neutral-500">
            {columns.map((column) => (
              <th key={column} className="py-3">
                {column}
              </th>
            ))}
            {numericColumns.map((column) => (
              <th key={column} className="py-3 text-right">
                {column}
              </th>
            ))}
            <th className="py-3 text-right">
              <span className="sr-only">{t('personalLearningDetails')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((subject) => (
            <tr key={subject.jobId} className="border-t border-line">
              <td className="max-w-xs truncate py-2 font-medium">{learnerLabel(subject)}</td>
              <td className="max-w-xs truncate py-2">{subject.filename}</td>
              <td className="py-2">{subject.pipelineStatus}</td>
              <td className="py-2">{subject.progressStatus ?? '—'}</td>
              <td className="py-2 text-right">{subject.totalAnswers.toLocaleString()}</td>
              <td className="py-2 text-right">
                {subject.totalAnswers > 0 ? formatPercent(subject.accuracy) : '—'}
              </td>
              <td className="py-2 text-right">{subject.progressPercent}%</td>
              <td className="py-2 text-right">{formatDateTime(subject.lastActivityAt)}</td>
              <td className="py-2 text-right">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onSelect(subject)}
                  aria-label={t('personalLearningDetailsFor', { subject: subject.filename })}
                >
                  {t('personalLearningDetails')}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
