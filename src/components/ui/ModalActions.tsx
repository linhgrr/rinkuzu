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
    <div className="flex justify-end space-x-3">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={isLoading}
        className="min-h-[40px] px-4"
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
            ? 'min-h-[40px] bg-red-600 px-4 hover:bg-red-700'
            : 'min-h-[40px] px-4'
        }
      >
        {confirmText}
      </Button>
    </div>
  );
}
