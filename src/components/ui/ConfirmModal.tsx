'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?:
    | 'default'
    | 'primary'
    | 'secondary'
    | 'outline'
    | 'ghost'
    | 'destructive'
    | 'link'
    | 'gradient'
    | 'accent';
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  confirmVariant = 'destructive',
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmModalProps) {
  const tCommon = useTranslations('common');
  const resolvedTitle = title ?? tCommon('confirm');
  const resolvedConfirmText = confirmText ?? tCommon('confirm');
  const resolvedCancelText = cancelText ?? tCommon('cancel');

  return (
    <Modal isOpen={isOpen} onClose={isLoading ? () => {} : onCancel} title={resolvedTitle}>
      <div className="space-y-5">
        <div className="break-words text-[15px] leading-7 text-neutral-600 sm:text-base">
          {message}
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-neutral-100 pt-5 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="min-h-11 w-full justify-center px-5 font-medium sm:w-auto"
          >
            {resolvedCancelText}
          </Button>
          <Button
            variant={confirmVariant}
            onClick={onConfirm}
            loading={isLoading}
            disabled={isLoading}
            className="min-h-11 w-full justify-center px-5 font-medium sm:w-auto"
          >
            {resolvedConfirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
