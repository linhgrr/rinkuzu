'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { ROUTES } from '@/shared/constants';
import { usePendingQuizUploadStore } from '@/store/usePendingQuizUploadStore';
import { MAX_QUIZ_PDF_BYTES } from '@/lib/quiz/constants';

const ASSET_BASE = '/images/home-redesign';

export function QuizUploadDropzone() {
  const router = useRouter();
  const t = useTranslations('dashboard.home');
  const setPendingFile = usePendingQuizUploadStore((s) => s.setFile);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showError = (message: string) => {
    setError(message);
    toast.error(message);
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      showError(t('upload.errors.onlyPdf'));
      return;
    }
    if (file.size > MAX_QUIZ_PDF_BYTES) {
      showError(t('upload.errors.fileTooLarge'));
      return;
    }
    setError(null);
    setPendingFile(file);
    router.push(ROUTES.CREATE_QUIZ);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragActive(false);
        handleFile(event.dataTransfer.files?.[0]);
      }}
      className={`flex min-h-[180px] flex-1 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[10px] border border-dashed p-4 text-center transition-colors ${
        dragActive
          ? 'border-accent bg-accent-soft/40'
          : 'border-line-blue bg-surface-blue hover:border-accent hover:bg-accent-soft/30'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(event) => {
          handleFile(event.target.files?.[0]);
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
        {error ?? t('upload.hint')}
      </span>
    </div>
  );
}
