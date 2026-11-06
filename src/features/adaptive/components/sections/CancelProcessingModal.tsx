'use client';

import { ConfirmModal } from '@/components/ui/ConfirmModal';
import type { TranslateFn } from '@/features/adaptive/types/learning';

type CancelProcessingModalProps = {
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  t: TranslateFn;
};

/** Confirmation before a processing job is cancelled; a failure stays inline (RIN-1005). */
export const CancelProcessingModal = ({
  isOpen,
  isLoading,
  error,
  onConfirm,
  onCancel,
  t,
}: CancelProcessingModalProps) => (
  <ConfirmModal
    isOpen={isOpen}
    title={t('cancelProcessingTitle')}
    message={
      <>
        <span className="text-sm text-neutral-500">{t('cancelProcessingDescription')}</span>
        {error ? (
          <span role="alert" className="mt-3 block text-sm font-semibold text-red-600">
            {error}
          </span>
        ) : null}
      </>
    }
    confirmText={t('cancelProcessingConfirm')}
    cancelText={t('keepProcessing')}
    confirmVariant="destructive"
    onConfirm={onConfirm}
    onCancel={onCancel}
    isLoading={isLoading}
  />
);
