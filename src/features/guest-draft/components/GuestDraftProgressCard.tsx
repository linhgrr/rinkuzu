'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  HiOutlineCheckCircle,
  HiOutlineDocumentText,
  HiOutlineExclamationCircle,
} from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { GuestDraftProgress } from '@/features/guest-draft/types/guest-draft-view-model';
import { cn } from '@/lib/utils';

interface GuestDraftProgressCardProps {
  phase: 'uploading' | 'processing' | 'ready';
  file: File;
  progress: GuestDraftProgress | null;
  pollErrors: number;
  onCancel: () => void;
  onPlayNow: () => void;
}

function statusLine(
  t: ReturnType<typeof useTranslations<'guestDraft.progress'>>,
  props: GuestDraftProgressCardProps,
): string {
  const count = props.progress?.questionCount ?? 0;
  if (props.phase === 'ready') return t('ready', { count });
  if (props.phase === 'uploading') return t('uploading');
  if (props.pollErrors > 0) return t('pollError');
  return t('processing', { percent: props.progress?.percent ?? 0, count });
}

/** Upload and processing progress of a guest draft, then "Quiz ready" (RIN-1448 AC4). */
export function GuestDraftProgressCard(props: GuestDraftProgressCardProps) {
  const { phase, file, progress, onCancel, onPlayNow } = props;
  const t = useTranslations('guestDraft.progress');
  const playRef = useRef<HTMLButtonElement>(null);
  const ready = phase === 'ready';
  const percent = ready ? 100 : (progress?.percent ?? 0);

  useEffect(() => {
    if (ready) playRef.current?.focus();
  }, [ready]);

  return (
    <Card variant="bordered" className="space-y-4 p-5 sm:p-6">
      <div className="flex min-w-0 items-center gap-x-3">
        {ready ? (
          <HiOutlineCheckCircle
            className="size-10 flex-shrink-0 text-green-500"
            aria-hidden="true"
          />
        ) : (
          <div className="flex-shrink-0 rounded-xl bg-red-100 p-2">
            <HiOutlineDocumentText className="size-6 text-red-600" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-neutral-900" title={file.name}>
            {file.name}
          </p>
          <p className="text-xs text-neutral-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
        <div
          data-testid="guest-draft-progress-fill"
          className={cn(
            'h-full rounded-full bg-brand-trust transition-[width] duration-500',
            phase === 'uploading' && 'w-2/5 motion-safe:animate-pulse',
          )}
          style={phase === 'uploading' ? undefined : { width: `${percent}%` }}
        />
      </div>
      <p role="status" aria-live="polite" className="text-sm text-neutral-600">
        {statusLine(t, props)}
      </p>
      {ready ? (
        <Button
          ref={playRef}
          size="lg"
          onClick={onPlayNow}
          className="h-14 w-full sm:w-auto sm:min-w-64"
        >
          {t('playNow')}
        </Button>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-neutral-500">{t('hint')}</p>
          <Button
            variant="ghost"
            onClick={onCancel}
            className="min-h-11 self-start text-red-600 hover:bg-red-50 hover:text-red-700 sm:self-auto"
          >
            {t('cancel')}
          </Button>
        </div>
      )}
    </Card>
  );
}

interface GuestDraftFailedCardProps {
  onRetry: () => void;
  onChooseAnother: () => void;
}

/** Failed extraction (RIN-1448 AC8): the try does not count; retry with the same file. */
export function GuestDraftFailedCard({ onRetry, onChooseAnother }: GuestDraftFailedCardProps) {
  const t = useTranslations('guestDraft.failed');
  return (
    <Card variant="bordered" role="alert" className="space-y-4 border-red-200 bg-red-50 p-5 sm:p-6">
      <div className="flex items-start gap-3 text-red-700">
        <HiOutlineExclamationCircle className="mt-0.5 size-6 flex-shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="font-semibold">{t('title')}</h2>
          <p className="mt-1 text-sm">{t('body')}</p>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={onRetry} className="w-full sm:w-auto">
          {t('retry')}
        </Button>
        <Button variant="ghost" onClick={onChooseAnother} className="w-full sm:w-auto">
          {t('chooseAnother')}
        </Button>
      </div>
    </Card>
  );
}
