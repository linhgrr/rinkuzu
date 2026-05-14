import React, { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { uploadImageToImgBB } from '@/services/imageUploadService';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

interface ImageUploadProps {
  currentImage?: string;
  onImageUploaded: (imageUrl: string) => void;
  onImageRemoved: () => void;
  placeholder?: string;
  maxWidth?: number;
  maxHeight?: number;
  className?: string;
}

export function ImageUpload({
  currentImage,
  onImageUploaded,
  onImageRemoved,
  placeholder,
  maxWidth = 400,
  maxHeight = 300,
  className = '',
}: ImageUploadProps) {
  const t = useTranslations('upload');
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isHoveredRef = useRef(false);

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        toast.error(t('pleaseSelectImage'));
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error(t('imageTooLarge'));
        return;
      }

      setIsUploading(true);
      try {
        const result = await uploadImageToImgBB(file, file.name);
        onImageUploaded(result.displayUrl);
      } catch (error: unknown) {
        console.error('Failed to upload image:', error);
        toast.error(
          `${t('failedToUpload')}: ${extractUnknownErrorMessage(error, 'Unknown upload error')}`,
        );
      } finally {
        setIsUploading(false);
      }
    },
    [onImageUploaded, t],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleImageUpload(file);
      }
    },
    [handleImageUpload],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);

      const file = e.dataTransfer.files?.[0];
      if (file) {
        handleImageUpload(file);
      }
    },
    [handleImageUpload],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            handleImageUpload(file);
            break;
          }
        }
      }
    },
    [handleImageUpload],
  );

  const handleImageUploadRef = useRef(handleImageUpload);

  useEffect(() => {
    handleImageUploadRef.current = handleImageUpload;
  }, [handleImageUpload]);

  // Global paste handler for hover-based pasting
  useEffect(() => {
    const onWindowPaste = (event: ClipboardEvent) => {
      if (!isHoveredRef.current) return;

      const items = event.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            void handleImageUploadRef.current(file);
            event.preventDefault();
            break;
          }
        }
      }
    };

    window.addEventListener('paste', onWindowPaste);

    return () => {
      window.removeEventListener('paste', onWindowPaste);
    };
  }, []);

  const handleMouseEnter = () => {
    isHoveredRef.current = true;
  };

  const handleMouseLeave = () => {
    isHoveredRef.current = false;
  };

  const triggerFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  if (currentImage) {
    return (
      <>
        <div
          className={`relative group ${className}`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <Image
            src={currentImage}
            alt="Uploaded image"
            width={maxWidth}
            height={maxHeight}
            className="rounded-lg border border-neutral-200 shadow-sm"
            style={{
              maxWidth: maxWidth,
              maxHeight: maxHeight,
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
            }}
          />
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              onClick={() => setShowRemoveConfirm(true)}
              variant="ghost"
              size="icon"
              className="size-9 bg-red-600 text-white hover:bg-red-700"
              aria-label={t('removeImage')}
            >
              <span aria-hidden="true">✕</span>
            </Button>
          </div>
        </div>
        <ConfirmModal
          isOpen={showRemoveConfirm}
          title={t('removeImageTitle')}
          message={t('removeImageConfirm')}
          confirmText={t('removeImage')}
          onCancel={() => setShowRemoveConfirm(false)}
          onConfirm={() => {
            onImageRemoved();
            setShowRemoveConfirm(false);
          }}
        />
      </>
    );
  }

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <button
        type="button"
        onClick={triggerFilePicker}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onPaste={handlePaste}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`
          relative rounded-xl border-2 border-dashed p-6 text-center
          transition-colors duration-200 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring-soft)]
          ${
            dragActive
              ? 'border-brand-action bg-orange-50'
              : 'border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50'
          }
          ${isUploading ? 'pointer-events-none opacity-75' : ''}
        `}
        style={{ minHeight: '120px' }}
      >
        {isUploading ? (
          <div className="flex flex-col items-center justify-center gap-y-2">
            <div className="size-8 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust" />
            <span className="text-sm text-neutral-600">{t('uploadingImage')}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-y-2">
            <svg
              className="size-12 text-neutral-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              />
            </svg>
            <div className="text-sm text-neutral-600">
              <span className="font-medium text-brand-action">{t('clickToUpload')}</span>
              <span> {t('orDragAndDrop')}</span>
            </div>
            <p className="text-xs text-neutral-500">{placeholder || t('clickToUpload')}</p>
            <p className="text-xs text-neutral-400">{t('maxFileSize')}</p>
          </div>
        )}
      </button>
    </div>
  );
}

// Specialized components for question and option images
interface QuestionImageUploadProps {
  currentImage?: string;
  onImageUploaded: (imageUrl: string) => void;
  onImageRemoved: () => void;
}

export function QuestionImageUpload(props: QuestionImageUploadProps) {
  return (
    <ImageUpload
      {...props}
      placeholder="Add image to question (optional)"
      maxWidth={600}
      maxHeight={400}
      className="w-full"
    />
  );
}

interface OptionImageUploadProps {
  currentImage?: string;
  onImageUploaded: (imageUrl: string) => void;
  onImageRemoved: () => void;
}

export function OptionImageUpload(props: OptionImageUploadProps) {
  return (
    <ImageUpload
      {...props}
      placeholder="Add image to option (optional)"
      maxWidth={200}
      maxHeight={150}
      className="mt-2"
    />
  );
}
