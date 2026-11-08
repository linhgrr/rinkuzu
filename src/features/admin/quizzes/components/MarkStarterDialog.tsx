'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { HiOutlineStar } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { getStarterMarkBlockReason } from '@/features/admin/quizzes/mappers/admin-starter-quizzes.mapper';
import type {
  AdminStarterQuizzesController,
  StarterMarkTarget,
} from '@/features/admin/quizzes/hooks/useAdminStarterQuizzes';
import type { AdminStarterQuizLocale } from '@/features/admin/quizzes/types/admin-starter-quizzes-view-model';

const MARK_BLOCK_KEYS = {
  starter: 'markBlockedStarter',
  'not-public': 'markBlockedNotPublic',
  empty: 'markBlockedEmpty',
} as const;

interface MarkStarterButtonProps {
  quiz: { id: string; title: string; visibility: 'public' | 'personal'; questionCount: number };
  controller: AdminStarterQuizzesController;
}

/** The row action; disabled with the reason as a tooltip for quizzes that cannot be starters. */
export function MarkStarterButton({ quiz, controller }: MarkStarterButtonProps) {
  const t = useTranslations('admin.starterQuizzes');
  const blockReason = getStarterMarkBlockReason(quiz, controller.starterQuizIds);
  const hint = blockReason ? t(MARK_BLOCK_KEYS[blockReason]) : undefined;

  return (
    <span title={hint} className="inline-flex">
      <Button
        size="sm"
        variant="outline"
        disabled={blockReason !== null || controller.loading || controller.loadError !== null}
        aria-describedby={hint ? `mark-starter-hint-${quiz.id}` : undefined}
        onClick={() => controller.openMark({ quizId: quiz.id, title: quiz.title })}
      >
        <HiOutlineStar className="mr-1 size-4" aria-hidden="true" />
        {t('markAction')}
      </Button>
      {hint ? (
        <span id={`mark-starter-hint-${quiz.id}`} className="sr-only">
          {hint}
        </span>
      ) : null}
    </span>
  );
}

interface MarkStarterFormProps {
  target: StarterMarkTarget;
  controller: AdminStarterQuizzesController;
}

function MarkStarterForm({ target, controller }: MarkStarterFormProps) {
  const t = useTranslations('admin.starterQuizzes');
  const pageLocale = useLocale();
  const [locale, setLocale] = useState<AdminStarterQuizLocale>(pageLocale === 'en' ? 'en' : 'vi');
  const last = controller.items.length + 1;
  const [position, setPosition] = useState(last);
  const pending = controller.pendingId === 'mark';

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void controller.mark({ quizId: target.quizId, locale, order: position });
      }}
    >
      <p className="text-sm text-ink/70">{t('markDescription', { title: target.title })}</p>
      <Select
        label={t('localeField')}
        value={locale}
        onChange={(event) => setLocale(event.target.value as AdminStarterQuizLocale)}
      >
        <option value="vi">{t('localeVi')}</option>
        <option value="en">{t('localeEn')}</option>
      </Select>
      <Select
        label={t('positionField')}
        value={String(position)}
        onChange={(event) => setPosition(Number(event.target.value))}
      >
        {Array.from({ length: last }, (_, index) => index + 1).map((value) => (
          <option key={value} value={value}>
            {value === last ? t('positionLast', { position: value }) : value}
          </option>
        ))}
      </Select>
      {controller.markError ? (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {controller.markError}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => controller.openMark(null)}
        >
          {t('cancel')}
        </Button>
        <Button type="submit" loading={pending}>
          {t('markConfirm')}
        </Button>
      </div>
    </form>
  );
}

/** Locale (preset from the page language) and position (default last) for a new starter. */
export function MarkStarterDialog({ controller }: { controller: AdminStarterQuizzesController }) {
  const t = useTranslations('admin.starterQuizzes');
  const target = controller.markTarget;

  return (
    <Modal
      isOpen={target !== null}
      title={t('markTitle')}
      onClose={() => {
        if (controller.pendingId !== 'mark') controller.openMark(null);
      }}
    >
      {target ? (
        <MarkStarterForm key={target.quizId} target={target} controller={controller} />
      ) : null}
    </Modal>
  );
}
