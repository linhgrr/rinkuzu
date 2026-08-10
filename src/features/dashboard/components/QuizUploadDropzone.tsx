'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { ROUTES } from '@/shared/constants/routes';
import { usePendingQuizUploadStore } from '@/store/usePendingQuizUploadStore';
import { MAX_QUIZ_PDF_MB } from '@/lib/quiz/constants';
import { getPdfPageCount } from '@/lib/pdf';
import { usePdfUploadPolicy } from '@/hooks/usePdfUploadPolicy';
import { cn } from '@/lib/utils';

const ASSET_BASE = '/images/home-redesign';

interface QuizUploadDropzoneProps {
  className?: string;
}

export function QuizUploadDropzone({ className }: QuizUploadDropzoneProps) {
  const router = useRouter();
  const t = useTranslations('dashboard.home');
  const setPendingFile = usePendingQuizUploadStore((s) => s.setFile);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploadPolicy = usePdfUploadPolicy('quiz');

  const showError = (message: string) => {
    setError(message);
    toast.error(message);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      showError(t('upload.errors.onlyPdf'));
      return;
    }
    if (file.size > uploadPolicy.maxBytes) {
      showError(t('upload.errors.fileTooLarge', { size: MAX_QUIZ_PDF_MB }));
      return;
    }
    try {
      const pageCount = await getPdfPageCount(file);
      if (pageCount > uploadPolicy.maxPages) {
        showError(
          t('upload.errors.tooManyPages', {
            pages: pageCount,
            maxPages: uploadPolicy.maxPages,
          }),
        );
        return;
      }
    } catch {
      showError(t('upload.errors.unreadablePdf'));
      return;
    }
    setError(null);
    setPendingFile(file);
    router.push(ROUTES.CREATE_QUIZ_PDF);
  };

  return (
    <label
      onDragOver={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragActive(false);
        void handleFile(event.dataTransfer.files?.[0]);
      }}
      className={cn(
        'flex min-h-[180px] flex-1 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[10px] border border-dashed p-4 text-center transition-colors',
        dragActive
          ? 'border-accent bg-accent-soft/40'
          : 'border-line-blue bg-surface-blue hover:border-accent hover:bg-accent-soft/30',
        className,
      )}
    >
      <input
        type="file"
        accept="application/pdf"
        className="hidden"
        aria-label={t('upload.cta')}
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.currentTarget.value = '';
        }}
      />
      <Image
        src={`${ASSET_BASE}/upload-icon.svg`}
        alt=""
        width={40}
        height={40}
        className="size-10"
      />
      <span className="font-home text-base font-semibold leading-[1.4] text-ink">
        {t('upload.cta')}
      </span>
      <span
        className={`font-home text-sm font-normal leading-[1.4] ${
          error ? 'text-red-600' : 'text-ink-muted'
        }`}
        aria-live="polite"
      >
        {error ?? t('upload.hint', { pages: uploadPolicy.maxPages, size: MAX_QUIZ_PDF_MB })}
      </span>
    </label>
  );
}
