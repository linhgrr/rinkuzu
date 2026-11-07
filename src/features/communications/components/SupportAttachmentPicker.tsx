'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Image, { type ImageLoaderProps } from 'next/image';
import { useTranslations } from 'next-intl';
import { HiOutlinePhotograph, HiOutlineX } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import {
  acceptSupportImages,
  SUPPORT_IMAGE_ACCEPT,
  SUPPORT_MAX_IMAGES,
  supportImageKey,
} from '../lib/support-form';
import { SupportFieldMessage } from './SupportUi';

interface SupportAttachmentPickerProps {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}

/**
 * Screenshot picker for support messages (RIN-1018): a localised button instead of the
 * browser's "Choose Files", and a thumbnail list where each image can be removed.
 */
export function SupportAttachmentPicker({
  files,
  onChange,
  disabled = false,
}: SupportAttachmentPickerProps) {
  const t = useTranslations('communications.support');
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const errorId = useId();
  const [rejected, setRejected] = useState(false);
  const full = files.length >= SUPPORT_MAX_IMAGES;

  return (
    <div className="w-full font-home">
      <p id={hintId} className="mb-1.5 text-xs font-semibold text-ink">
        {t('attachments')}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={SUPPORT_IMAGE_ACCEPT}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        aria-label={t('addImages')}
        disabled={disabled || full}
        onChange={(event) => {
          const result = acceptSupportImages(files, Array.from(event.target.files ?? []));
          setRejected(result.rejected);
          onChange(result.files);
          event.target.value = '';
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || full}
        aria-describedby={rejected ? `${hintId} ${errorId}` : hintId}
        onClick={() => inputRef.current?.click()}
      >
        <HiOutlinePhotograph className="size-4" aria-hidden="true" />
        {t('addImages')}
      </Button>
      {rejected ? (
        <SupportFieldMessage id={errorId}>{t('errors.attachmentRejected')}</SupportFieldMessage>
      ) : null}
      {files.length ? (
        <ul aria-label={t('attachments')} className="mt-3 flex flex-wrap gap-3">
          {files.map((file) => (
            <li key={supportImageKey(file)} className="relative">
              <AttachmentThumbnail file={file} />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute -right-2 -top-2 size-7 rounded-full"
                aria-label={t('removeImage', { name: file.name })}
                disabled={disabled}
                onClick={() => {
                  setRejected(false);
                  onChange(files.filter((other) => other !== file));
                }}
              >
                <HiOutlineX className="size-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function AttachmentThumbnail({ file }: { file: File }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setSrc(reader.result);
    };
    reader.readAsDataURL(file);
    return () => reader.abort();
  }, [file]);

  if (!src) return <span className="block size-16 rounded-lg bg-surface-warm" aria-hidden="true" />;
  return (
    <Image
      src={src}
      alt={file.name}
      loader={passthroughImageLoader}
      unoptimized
      width={64}
      height={64}
      className="size-16 rounded-lg border border-line object-cover"
    />
  );
}

function passthroughImageLoader({ src }: ImageLoaderProps): string {
  return src;
}
