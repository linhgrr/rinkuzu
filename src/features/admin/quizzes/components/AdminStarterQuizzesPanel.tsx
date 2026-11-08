'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  HiOutlineArrowDown,
  HiOutlineArrowUp,
  HiOutlineExclamation,
  HiOutlineSparkles,
  HiOutlineX,
} from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ErrorState } from '@/components/ui/ErrorState';
import { Select } from '@/components/ui/Select';
import { AdminStarterQuizzesSkeleton } from '@/features/admin/components/AdminLoadingSkeletons';
import { MarkStarterDialog } from '@/features/admin/quizzes/components/MarkStarterDialog';
import {
  STARTER_DROP_REASON_KEYS,
  type AdminStarterQuizzesController,
} from '@/features/admin/quizzes/hooks/useAdminStarterQuizzes';
import type {
  AdminStarterQuizLocale,
  AdminStarterQuizViewModel,
} from '@/features/admin/quizzes/types/admin-starter-quizzes-view-model';

/** Row actions are 36px (`sm`); below lg they grow to a 44px touch target (RIN-1228). */
const ROW_ACTION_TOUCH_TARGET = 'min-h-11 min-w-11 lg:min-h-0 lg:min-w-0';

interface StarterRowProps {
  item: AdminStarterQuizViewModel;
  total: number;
  busy: boolean;
  controller: AdminStarterQuizzesController;
  onUnmark: (item: AdminStarterQuizViewModel) => void;
}

function StarterRow({ item, total, busy, controller, onUnmark }: StarterRowProps) {
  const t = useTranslations('admin.starterQuizzes');
  const title = item.title ?? t('untitled');

  return (
    <li className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-trust/10 text-sm font-semibold text-brand-trust">
          {item.order}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-ink">{title}</h3>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold uppercase text-neutral-600">
              {item.locale}
            </span>
            {item.quick ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                <HiOutlineSparkles className="size-3" aria-hidden="true" />
                {t('quickBadge')}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-ink/55">
            {t('questionCount', { count: item.questionCount })}
          </p>
          {item.dropReason ? (
            <p className="mt-2 flex items-start gap-1.5 text-sm text-amber-800">
              <HiOutlineExclamation className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                <span className="font-semibold">
                  {t('droppedLabel', { reason: t(STARTER_DROP_REASON_KEYS[item.dropReason]) })}
                </span>{' '}
                {t('droppedNote')}
              </span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
        <Button
          size="sm"
          variant="outline"
          className={ROW_ACTION_TOUCH_TARGET}
          aria-label={t('moveUp', { title })}
          disabled={busy || item.order <= 1}
          onClick={() => void controller.move(item.id, item.order - 1)}
        >
          <HiOutlineArrowUp className="size-4" aria-hidden="true" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className={ROW_ACTION_TOUCH_TARGET}
          aria-label={t('moveDown', { title })}
          disabled={busy || item.order >= total}
          onClick={() => void controller.move(item.id, item.order + 1)}
        >
          <HiOutlineArrowDown className="size-4" aria-hidden="true" />
        </Button>
        <div className="w-36 shrink-0">
          <Select
            value={item.locale}
            selectSize="sm"
            aria-label={t('localeFor', { title })}
            disabled={busy}
            className="min-h-11 bg-surface lg:min-h-0"
            onChange={(event) =>
              void controller.setLocale(item.id, event.target.value as AdminStarterQuizLocale)
            }
          >
            <option value="vi">{t('localeVi')}</option>
            <option value="en">{t('localeEn')}</option>
          </Select>
        </div>
        <Button
          size="sm"
          variant="outline"
          className={`${ROW_ACTION_TOUCH_TARGET} border-red-200 text-red-600 hover:border-red-300 hover:text-red-700`}
          disabled={busy}
          onClick={() => onUnmark(item)}
        >
          <HiOutlineX className="mr-1 size-4" aria-hidden="true" />
          {t('unmark')}
        </Button>
      </div>
    </li>
  );
}

interface AdminStarterQuizzesPanelProps {
  controller: AdminStarterQuizzesController;
}

function StarterPanelBody({ controller }: AdminStarterQuizzesPanelProps) {
  const t = useTranslations('admin.starterQuizzes');
  const [starterToUnmark, setStarterToUnmark] = useState<AdminStarterQuizViewModel | null>(null);

  if (controller.loadError) {
    return <ErrorState error={controller.loadError} onRetry={controller.retry} className="m-4" />;
  }
  if (controller.loading) return <AdminStarterQuizzesSkeleton />;
  if (controller.items.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="font-semibold text-ink">{t('emptyTitle')}</p>
        <p className="mt-1 text-sm text-ink/55">{t('emptyHint')}</p>
      </div>
    );
  }

  return (
    <>
      <ol className="divide-y divide-line-blue/25" aria-label={t('listLabel')}>
        {controller.items.map((item) => (
          <StarterRow
            key={item.id}
            item={item}
            total={controller.items.length}
            busy={controller.pendingId !== null}
            controller={controller}
            onUnmark={setStarterToUnmark}
          />
        ))}
      </ol>
      <ConfirmModal
        isOpen={starterToUnmark !== null}
        title={t('unmarkTitle')}
        message={t('unmarkMessage', { title: starterToUnmark?.title ?? t('untitled') })}
        confirmText={t('unmark')}
        cancelText={t('cancel')}
        confirmVariant="destructive"
        isLoading={starterToUnmark !== null && controller.pendingId === starterToUnmark.id}
        onCancel={() => setStarterToUnmark(null)}
        onConfirm={() => {
          if (!starterToUnmark) return;
          void controller.unmark(starterToUnmark.id).then(() => setStarterToUnmark(null));
        }}
      />
    </>
  );
}

/** Starter quizzes new learners see on the dashboard, in order (RIN-1177). */
export function AdminStarterQuizzesPanel({ controller }: AdminStarterQuizzesPanelProps) {
  const t = useTranslations('admin.starterQuizzes');

  return (
    <section
      aria-labelledby="admin-starter-quizzes-heading"
      aria-busy={controller.loading}
      className="mt-6 overflow-hidden rounded-2xl border border-line-blue/30 bg-white"
    >
      <header className="border-b border-line-blue/25 px-5 py-4">
        <h2 id="admin-starter-quizzes-heading" className="text-lg font-semibold text-ink">
          {t('title')}
        </h2>
        <p className="mt-1 text-sm text-ink/60">{t('description')}</p>
      </header>
      <StarterPanelBody controller={controller} />
      <MarkStarterDialog controller={controller} />
    </section>
  );
}
