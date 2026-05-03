'use client';

import { Button } from '@/components/ui/Button';

interface ModalActionsProps {
  cancelText: string;
  confirmText: string;
  onCancel: () => void;
  onConfirm?: () => void;
  confirmType?: 'button' | 'submit';
  isLoading?: boolean;
  isDisabled?: boolean;
  confirmVariant?: 'primary' | 'destructive';
}

export function ModalActions({
  cancelText,
  confirmText,
  onCancel,
  onConfirm,
  confirmType = 'button',
  isLoading = false,
  isDisabled = false,
  confirmVariant = 'primary',
}: ModalActionsProps) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-3 border-t border-neutral-100 pt-5 sm:flex-row sm:justify-end">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={isLoading}
        className="min-h-11 w-full justify-center px-5 sm:w-auto"
      >
        {cancelText}
      </Button>
      <Button
        type={confirmType}
        onClick={onConfirm}
        loading={isLoading}
        disabled={isDisabled}
        className={
          confirmVariant === 'destructive'
            ? 'min-h-11 w-full justify-center bg-red-600 px-5 hover:bg-red-700 sm:w-auto'
            : 'min-h-11 w-full justify-center px-5 sm:w-auto'
        }
      >
        {confirmText}
      </Button>
    </div>
  );
}
