'use client';

import { Button } from '@/components/ui/Button';
import {
  HiOutlineCloudUpload,
  HiOutlineDocumentText,
  HiOutlineEyeOff,
  HiOutlineX,
} from 'react-icons/hi';

type PdfToggleConfig = {
  visible: boolean;
  onToggle: () => void;
  labels: {
    hide: string;
    show: string;
  };
};

interface DraftEditActionsProps {
  pdfToggle?: PdfToggleConfig;
  isSubmitting: boolean;
  canSubmit: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  labels: {
    cancel: string;
    submit: string;
    submitting: string;
  };
}

export function DraftEditActions({
  pdfToggle,
  isSubmitting,
  canSubmit,
  onCancel,
  onSubmit,
  labels,
}: DraftEditActionsProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      {pdfToggle ? (
        <Button
          type="button"
          onClick={pdfToggle.onToggle}
          variant="outline"
          className="flex items-center gap-2 border-green-200 text-brand-trust hover:bg-green-50"
        >
          {pdfToggle.visible ? (
            <>
              <HiOutlineEyeOff className="size-4" />
              {pdfToggle.labels.hide}
            </>
          ) : (
            <>
              <HiOutlineDocumentText className="size-4" />
              {pdfToggle.labels.show}
            </>
          )}
        </Button>
      ) : (
        <span />
      )}

      <div className="ml-auto flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex items-center gap-2 px-6 py-3 text-neutral-700 hover:bg-neutral-50"
        >
          <HiOutlineX className="size-4" />
          {labels.cancel}
        </Button>
        <Button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting || !canSubmit}
          className="flex items-center gap-2 px-6 py-3"
        >
          {isSubmitting ? (
            <span
              className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent"
              aria-hidden
            />
          ) : (
            <HiOutlineCloudUpload className="size-5" />
          )}
          {isSubmitting ? labels.submitting : labels.submit}
        </Button>
      </div>
    </div>
  );
}
