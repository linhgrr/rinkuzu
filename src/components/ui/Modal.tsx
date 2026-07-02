'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Portal } from './Portal';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
  size?: 'small' | 'medium' | 'large' | 'wide' | 'full';
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  isOpen,
  onClose,
  children,
  title,
  description,
  className,
  size = 'medium',
}: ModalProps) {
  const tCommon = useTranslations('common');
  const titleId = React.useId();
  const descriptionId = React.useId();
  const dialogRef = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;

    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) {
      dialog.showModal();
    }

    return () => {
      if (dialog.open) {
        dialog.close();
      }
    };
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;

    const frame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const firstFocusable = dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (firstFocusable ?? dialog).focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    small: 'max-w-sm',
    medium: 'max-w-md',
    large: 'max-w-4xl',
    wide: 'max-w-[85vw]',
    full: 'max-w-7xl',
  };

  const handleCancel = (event: React.SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    onClose();
  };

  return (
    <Portal>
      <dialog
        ref={dialogRef}
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        onCancel={handleCancel}
        className="m-0 flex h-dvh max-h-none w-dvw max-w-none items-center justify-center overflow-hidden border-0 bg-transparent p-4 backdrop:bg-transparent sm:p-6"
      >
        <button
          type="button"
          className="fixed inset-0 bg-black/50"
          onClick={onClose}
          aria-label={tCommon('close')}
          tabIndex={-1}
        />

        <div
          className={cn(
            'relative mx-auto flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 sm:max-h-[90vh]',
            sizeClasses[size],
            className,
          )}
        >
          {(title || description) && (
            <div className="border-b border-neutral-100 p-5 pr-14 sm:p-6 sm:pr-16">
              {title && (
                <h2 id={titleId} className="text-lg font-semibold leading-7 text-neutral-900">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descriptionId} className="mt-1 text-sm text-neutral-500">
                  {description}
                </p>
              )}
            </div>
          )}

          {!(title || description) && <div>{children}</div>}
          {(title || description) && <div className="p-5 sm:p-6">{children}</div>}

          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 flex size-11 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-trust"
            aria-label={tCommon('close')}
          >
            <svg
              className="size-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </dialog>
    </Portal>
  );
}
