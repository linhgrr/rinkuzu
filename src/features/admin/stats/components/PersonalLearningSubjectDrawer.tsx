'use client';

import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import {
  formatDateTime,
  formatPercent,
  learnerLabel,
} from '@/features/admin/stats/lib/personal-learning-format';
import type { PersonalLearningSubjectViewModel } from '@/features/admin/stats/types/personal-learning-view-model';

interface PersonalLearningSubjectDrawerProps {
  subject: PersonalLearningSubjectViewModel | null;
  onClose: () => void;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-line py-2 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}

export function PersonalLearningSubjectDrawer({
  subject,
  onClose,
}: PersonalLearningSubjectDrawerProps) {
  const t = useTranslations('admin');

  if (!subject) return null;

  const timeline: Array<[string, string]> = [
    [t('personalLearningCreatedAt'), formatDateTime(subject.createdAt)],
    [t('personalLearningCompletedAt'), formatDateTime(subject.completedAt)],
    [t('personalLearningLastActivity'), formatDateTime(subject.lastActivityAt)],
  ];

  const details: Array<[string, string]> = [
    [t('personalLearningLearner'), learnerLabel(subject)],
    [t('personalLearningSubjectId'), subject.subjectId],
    [t('personalLearningJobId'), subject.jobId],
    [t('personalLearningPipelineStatus'), subject.pipelineStatus],
    [t('personalLearningProgressStatus'), subject.progressStatus ?? '—'],
    [t('personalLearningErrorCode'), subject.safeErrorCode ?? '—'],
    [
      t('personalLearningRetryable'),
      subject.retryable ? t('personalLearningYes') : t('personalLearningNo'),
    ],
    [
      t('personalLearningPartialSuccess'),
      subject.partialSuccess ? t('personalLearningYes') : t('personalLearningNo'),
    ],
    [t('personalLearningConceptsExtracted'), subject.conceptsExtracted.toLocaleString()],
    [t('personalLearningConceptsAfterMerge'), subject.conceptsAfterMerge.toLocaleString()],
    [t('personalLearningRelationsAccepted'), subject.relationsAccepted.toLocaleString()],
    [
      t('personalLearningDuration'),
      subject.durationSeconds === null
        ? '—'
        : t('personalLearningSeconds', { value: Math.round(subject.durationSeconds) }),
    ],
    [t('personalLearningAnswers'), subject.totalAnswers.toLocaleString()],
    [t('personalLearningCorrect'), subject.totalCorrect.toLocaleString()],
    [t('personalLearningAccuracy'), formatPercent(subject.accuracy)],
    [t('personalLearningMastery'), formatPercent(subject.averageMastery)],
    [t('personalLearningProgress'), `${subject.progressPercent}%`],
    [t('personalLearningMasteredConcepts'), subject.masteredConcepts.toLocaleString()],
    [t('personalLearningLastSession'), subject.lastSessionId ?? '—'],
  ];

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="wide"
      title={subject.filename}
      description={t('personalLearningDrawerDescription')}
    >
      <section aria-label={t('personalLearningTimeline')}>
        <h3 className="text-sm font-semibold text-ink">{t('personalLearningTimeline')}</h3>
        <dl className="mt-2">
          {timeline.map(([label, value]) => (
            <DetailRow key={label} label={label} value={value} />
          ))}
        </dl>
      </section>
      <section aria-label={t('personalLearningMetadata')} className="mt-6">
        <h3 className="text-sm font-semibold text-ink">{t('personalLearningMetadata')}</h3>
        <dl className="mt-2">
          {details.map(([label, value]) => (
            <DetailRow key={label} label={label} value={value} />
          ))}
        </dl>
      </section>
      <p className="mt-6 text-xs text-ink-muted">{t('personalLearningReadOnlyNote')}</p>
    </Modal>
  );
}
