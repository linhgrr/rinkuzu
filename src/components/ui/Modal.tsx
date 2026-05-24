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

  if (!isOpen) return null;

  const sizeClasses = {
    small: 'max-w-sm',
    medium: 'max-w-md',
    large: 'max-w-4xl',
    wide: 'max-w-[85vw]',
    full: 'max-w-7xl',
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop */}
        <button
          type="button"
          className="absolute inset-0 bg-black/50"
          onClick={onClose}
          aria-label={tCommon('close')}
        />

        {/* Modal */}
        <div
          className={cn(
            'relative w-full overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 max-h-[calc(100vh-2rem)] sm:max-h-[90vh]',
            sizeClasses[size],
            className,
          )}
        >
          {/* Header */}
          {(title || description) && (
            <div className="border-b border-neutral-100 p-5 pr-14 sm:p-6 sm:pr-16">
              {title && (
                <h2 className="text-lg font-semibold leading-7 text-neutral-900">{title}</h2>
              )}
              {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
            </div>
          )}

          {/* Content */}
          {!(title || description) && <div>{children}</div>}
          {(title || description) && <div className="p-5 sm:p-6">{children}</div>}

          {/* Close button */}
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
      </div>
    </Portal>
  );
}
