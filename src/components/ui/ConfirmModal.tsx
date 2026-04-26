'use client';

import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'default' | 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link' | 'gradient' | 'accent';
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  title = 'Xác nhận',
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  confirmVariant = 'destructive',
  onConfirm,
  onCancel,
  isLoading = false
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={isLoading ? () => { } : onCancel} title={title}>
      <div className="space-y-6">
        <div className="text-base text-neutral-600 leading-relaxed">
          {message}
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end mt-8 pt-5 border-t border-neutral-100">
          <Button variant="outline" onClick={onCancel} disabled={isLoading} className="sm:w-auto w-full font-medium">
            {cancelText}
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} loading={isLoading} disabled={isLoading} className="sm:w-auto w-full font-medium">
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
