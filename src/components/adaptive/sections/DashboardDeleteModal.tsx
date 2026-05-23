'use client';

import { ConfirmModal } from '@/components/ui/ConfirmModal';
import type { TranslateFn } from '@/features/adaptive/types';

type DashboardDeleteModalProps = {
  cancelText: string;
  isOpen: boolean;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  t: TranslateFn;
};

export const DashboardDeleteModal = ({
  cancelText,
  isOpen,
  isLoading,
  onConfirm,
  onCancel,
  t,
}: DashboardDeleteModalProps) => (
  <ConfirmModal
    isOpen={isOpen}
    title={t('deleteDocumentTitle')}
    message={<span className="text-sm text-neutral-500">{t('deleteConfirmDescription')}</span>}
    confirmText={t('deleteMaterial')}
    cancelText={cancelText}
    confirmVariant="destructive"
    onConfirm={onConfirm}
    onCancel={onCancel}
    isLoading={isLoading}
  />
);
