'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { HiOutlineShieldExclamation } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Select } from '@/components/ui/Select';
import { clearAdminQuizPersonalDataFlag } from '@/features/admin/quizzes/api/admin-quizzes-api';
import type { AdminQuizFlagFilterViewModel } from '@/features/admin/quizzes/types/admin-quizzes-view-model';
import { useAdminApiErrorMessage } from '@/lib/api/use-api-error';
import { toDisplayedPersonalDataKinds } from '@/lib/quiz/personal-data-kinds';

/** "Personal data: phone, email" on a flagged quiz row (RIN-1342). Kinds only, never values. */
export function PersonalDataFlagBadge({ kinds }: { kinds: readonly string[] }) {
  const t = useTranslations('admin');
  const labels = toDisplayedPersonalDataKinds(kinds).map((kind) =>
    t(`quizPersonalDataKinds.${kind}`),
  );

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
      <HiOutlineShieldExclamation aria-hidden className="size-3" />
      {t('quizPersonalDataBadge', { kinds: labels.join(', ') })}
    </span>
  );
}

export function PersonalDataFlagFilter({
  value,
  onChange,
}: {
  value: AdminQuizFlagFilterViewModel;
  onChange: (value: AdminQuizFlagFilterViewModel) => void;
}) {
  const t = useTranslations('admin');
  return (
    <Select
      value={value}
      aria-label={t('quizFlagFilterLabel')}
      onChange={(event) => onChange(event.target.value as AdminQuizFlagFilterViewModel)}
      className="bg-surface"
    >
      <option value="all">{t('quizFlagFilterAll')}</option>
      <option value="personal_data">{t('quizFlagFilterPersonalData')}</option>
    </Select>
  );
}

interface ClearPersonalDataFlagButtonProps {
  quiz: { id: string; title: string };
  onCleared: (quizId: string) => void;
  onError: (message: string) => void;
}

/** Admin Clear flag after a confirm step; the server audits each clear (RIN-1342). */
export function ClearPersonalDataFlagButton({
  quiz,
  onCleared,
  onError,
}: ClearPersonalDataFlagButtonProps) {
  const t = useTranslations('admin');
  const describeError = useAdminApiErrorMessage();
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function clearFlag() {
    setClearing(true);
    onError('');
    let failure: unknown = null;
    await clearAdminQuizPersonalDataFlag(quiz.id).catch((error: unknown) => {
      failure = error ?? new Error('clear failed');
    });
    setClearing(false);
    setConfirming(false);
    if (failure) {
      onError(describeError(failure, t('quizClearPersonalDataFlagError')));
      return;
    }
    onCleared(quiz.id);
  }

  return (
    <>
      <Button size="sm" variant="outline" disabled={clearing} onClick={() => setConfirming(true)}>
        <HiOutlineShieldExclamation className="mr-1 size-4" />
        {t('quizClearPersonalDataFlag')}
      </Button>
      <ConfirmModal
        isOpen={confirming}
        title={t('quizClearPersonalDataFlagTitle')}
        message={t('quizClearPersonalDataFlagConfirm', { title: quiz.title })}
        confirmText={t('quizClearPersonalDataFlag')}
        cancelText={t('cancel')}
        confirmVariant="primary"
        isLoading={clearing}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void clearFlag()}
      />
    </>
  );
}
