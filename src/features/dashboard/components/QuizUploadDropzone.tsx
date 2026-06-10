'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from '@/i18n/navigation';
import { ROUTES } from '@/shared/constants';

const ASSET_BASE = '/images/home-redesign';
const MAX_SIZE = 50 * 1024 * 1024;

export function QuizUploadDropzone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are supported');
      return;
    }
    if (file.size > MAX_SIZE) {
      setError('File exceeds 50MB');
      return;
    }
    setError(null);
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
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
      <Image
        src={`${ASSET_BASE}/upload-icon.svg`}
        alt=""
        width={40}
        height={40}
        className="size-10"
      />
      <span className="font-home text-base font-semibold leading-[1.4] text-ink">
        Click or drag & drop it here to upload
      </span>
      <span className="font-home text-sm font-normal leading-[1.4] text-ink-muted">
        {error ?? 'PDF format, max to 50MB per file'}
      </span>
    </div>
  );
}
