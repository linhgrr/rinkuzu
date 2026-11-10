'use client';

import { useDropzone } from 'react-dropzone';
import { useTranslations } from 'next-intl';
import { HiOutlineDocumentText, HiOutlineUpload, HiOutlineX } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import { GUEST_DRAFT_LIMIT_COPY } from '@/features/guest-draft/lib/guest-limit-copy';

interface GuestPdfDropZoneProps {
  file: File | null;
  checking: boolean;
  disabled: boolean;
  onChoose: (file: File | undefined) => void;
  onRemove: () => void;
}

function ChosenFileRow({
  file,
  checking,
  disabled,
  onRemove,
}: Omit<GuestPdfDropZoneProps, 'onChoose' | 'file'> & { file: File }) {
  const t = useTranslations('guestDraft.upload');
  return (
    <Card variant="bordered" className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-x-3">
          <div className="flex-shrink-0 rounded-xl bg-red-100 p-2">
            <HiOutlineDocumentText className="size-6 text-red-600" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-neutral-900" title={file.name}>
              {file.name}
            </p>
            {checking ? (
              <Spinner size="sm" label={t('checking')} />
            ) : (
              <p className="text-xs text-neutral-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={onRemove}
          disabled={disabled}
          aria-label={t('removeFile')}
          className="min-h-11 min-w-11 px-3 text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          <HiOutlineX className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </Card>
  );
}

/** The PDF picker of the guest upload page (RIN-1448): the drop zone, or the chosen file. */
export function GuestPdfDropZone({
  file,
  checking,
  disabled,
  onChoose,
  onRemove,
}: GuestPdfDropZoneProps) {
  const t = useTranslations('guestDraft.upload');
  // No `accept` filter: a non-PDF reaches `onChoose`, which shows "Only PDF files".
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: false,
    disabled,
    onDrop: (accepted, rejected) => onChoose(accepted[0] ?? rejected[0]?.file),
  });

  if (file) {
    return (
      <ChosenFileRow file={file} checking={checking} disabled={disabled} onRemove={onRemove} />
    );
  }

  return (
    <div
      {...getRootProps({ 'aria-label': t('dropzoneLabel') })}
      className={cn(
        'cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-[background-color,border-color] duration-300',
        isDragActive
          ? 'border-brand-action/60 bg-orange-50/50'
          : 'border-neutral-300 hover:border-brand-action/40 hover:bg-orange-50/30',
      )}
    >
      <input {...getInputProps({ accept: 'application/pdf,.pdf' })} />
      <div className="space-y-4">
        <div
          className={cn(
            'inline-flex items-center justify-center rounded-2xl p-4 transition-colors duration-300',
            isDragActive ? 'bg-orange-500/10' : 'bg-neutral-100',
          )}
        >
          <HiOutlineUpload
            className={cn('size-8', isDragActive ? 'text-brand-action' : 'text-neutral-400')}
            aria-hidden="true"
          />
        </div>
        {isDragActive ? (
          <p className="text-lg font-semibold text-brand-action">{t('dropHere')}</p>
        ) : (
          <div>
            <p className="mb-2 text-lg font-semibold text-neutral-700">
              <span className="text-brand-action">{t('clickToUpload')}</span> {t('dragAndDrop')}
            </p>
            <p className="text-sm text-neutral-500">{t('limitHint', GUEST_DRAFT_LIMIT_COPY)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
