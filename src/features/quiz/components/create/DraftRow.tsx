'use client';

import { useMemo, type ComponentType } from 'react';
import { useTranslations } from 'next-intl';
import {
  HiOutlineBan,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineDocumentText,
  HiOutlineDotsHorizontal,
  HiOutlineExclamationCircle,
  HiOutlinePencilAlt,
  HiOutlineRefresh,
  HiOutlineTrash,
} from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Link, useRouter } from '@/i18n/navigation';
import { useApiErrorMessage } from '@/lib/api/use-api-error';
import { cn } from '@/lib/utils';
import type { QuizDraft } from '@/features/quiz/types/quiz-draft';
import { ROUTES } from '@/shared/constants/routes';

type DraftStatus = QuizDraft['status'];

/** A draft the API is still working on: the list polls while any row is in this state. */
export function isDraftActive(status: DraftStatus): boolean {
  return status === 'queued' || status === 'processing';
}

interface BadgeStyle {
  icon: ComponentType<{ className?: string; 'aria-hidden'?: 'true' }> | null;
  className: string;
}

const NEUTRAL_BADGE = 'bg-neutral-100 text-neutral-700';

const BADGE_BY_STATUS: Record<DraftStatus, BadgeStyle> = {
  drafting: { icon: null, className: NEUTRAL_BADGE },
  submitted: { icon: null, className: NEUTRAL_BADGE },
  queued: { icon: HiOutlineDotsHorizontal, className: NEUTRAL_BADGE },
  processing: { icon: HiOutlineRefresh, className: 'bg-brand-trust/10 text-brand-trust' },
  completed: { icon: HiOutlineCheckCircle, className: 'bg-green-50 text-green-700' },
  failed: { icon: HiOutlineExclamationCircle, className: 'bg-red-50 text-red-700' },
  cancelled: { icon: HiOutlineBan, className: NEUTRAL_BADGE },
  expired: { icon: HiOutlineBan, className: NEUTRAL_BADGE },
};

/** The word always stays: colour and icon only back it up. */
function StatusBadge({ status, label }: { status: DraftStatus; label: string }) {
  const { icon: Icon, className } = BADGE_BY_STATUS[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
        className,
      )}
    >
      {Icon ? (
        <Icon
          className={cn('size-4 shrink-0', status === 'processing' && 'motion-safe:animate-spin')}
          aria-hidden="true"
        />
      ) : null}
      {label}
    </span>
  );
}

function ProgressBlock({ processed, total }: { processed: number; total: number }) {
  const t = useTranslations('create');
  if (total <= 0) {
    return <p className="mt-3 text-sm text-neutral-600">{t('draftProgressIndeterminate')}</p>;
  }
  const label = t('draftProgress', { processed, total });
  const percent = Math.min(100, Math.max(0, Math.round((processed / total) * 100)));
  return (
    <div className="mt-3">
      <p className="text-sm text-neutral-600">{label}</p>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={Math.min(processed, total)}
        className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100"
      >
        <div
          className="h-full rounded-full bg-brand-trust motion-safe:transition-[width] motion-safe:duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

interface DraftRowProps {
  draft: QuizDraft;
  dateFormatter: Intl.DateTimeFormat;
  onDelete: (draftId: string) => void;
}

/** One row of "Your drafts" on /create (RIN-1733): status, progress, failure reason and actions. */
export function DraftRow({ draft, dateFormatter, onDelete }: DraftRowProps) {
  const t = useTranslations('create');
  const apiErrorMessage = useApiErrorMessage();
  const { push } = useRouter();
  const { status } = draft;

  // Only the code is mapped: `draft.error` is server text and is never shown. The helper logs
  // each call, so the message is computed once per code, not once per poll render.
  const failedReason = useMemo(
    () =>
      status === 'failed'
        ? apiErrorMessage(
            draft.errorCode ? { code: draft.errorCode } : null,
            t('draftFailedReason'),
          )
        : '',
    [status, draft.errorCode, apiErrorMessage, t],
  );

  const reason =
    status === 'failed'
      ? failedReason
      : status === 'expired'
        ? t('draftExpiredReason')
        : status === 'cancelled'
          ? t('draftCancelledReason')
          : null;
  const canContinue = ['drafting', 'completed', 'submitted'].includes(status);

  return (
    <Card className="border-line bg-white p-0 shadow-none">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 sm:flex-1">
          <div className="flex min-w-0 items-center gap-2">
            {draft.sourceType === 'manual' ? (
              <HiOutlinePencilAlt className="size-5 shrink-0 text-brand-trust" />
            ) : (
              <HiOutlineDocumentText className="size-5 shrink-0 text-neutral-600" />
            )}
            <h3
              title={draft.title}
              className="line-clamp-2 min-w-0 break-words font-semibold text-neutral-950 sm:line-clamp-1"
            >
              {draft.title}
            </h3>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-neutral-500">
            <StatusBadge status={status} label={t(`draftStatus.${status}`)} />
            <span>{t('draftQuestionCount', { count: draft.questionCount })}</span>
            <span className="inline-flex items-center gap-2">
              <HiOutlineClock className="size-4" aria-hidden="true" />
              {dateFormatter.format(new Date(draft.updatedAt))}
            </span>
          </div>
          {status === 'processing' ? (
            <ProgressBlock processed={draft.progress.processed} total={draft.progress.total} />
          ) : null}
          {reason ? (
            <p
              className={cn(
                'mt-3 text-sm',
                status === 'failed' ? 'text-red-700' : 'text-neutral-600',
              )}
            >
              {reason}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canContinue ? (
            <Button
              variant={status === 'completed' ? 'default' : 'outline'}
              onClick={() => push(ROUTES.DRAFT.EDIT(draft.id))}
            >
              {t('continueEditing')}
            </Button>
          ) : null}
          {status === 'failed' ? (
            <Link href={ROUTES.CREATE_QUIZ_PDF} className="btn btn-secondary">
              {t('draftTryAgain')}
            </Link>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('deleteDraftNamed', { title: draft.title })}
            onClick={() => onDelete(draft.id)}
            className="text-neutral-500 hover:text-red-600"
          >
            <HiOutlineTrash className="size-5" aria-hidden="true" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
