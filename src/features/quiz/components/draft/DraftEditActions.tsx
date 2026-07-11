'use client';

import { Button } from '@/components/ui/Button';
import {
  HiOutlineCloudUpload,
  HiOutlineDocumentText,
  HiOutlineEyeOff,
  HiOutlineX,
} from 'react-icons/hi';

interface DraftEditActionsProps {
  hasPdf: boolean;
  showPdfViewer: boolean;
  isSubmitting: boolean;
  canSubmit: boolean;
  onTogglePdf: () => void;
  onCancel: () => void;
  onSubmit: () => void;
  labels: {
    hidePdf: string;
    showPdf: string;
    cancel: string;
    submit: string;
    submitting: string;
  };
}

export function DraftEditActions({
  hasPdf,
  showPdfViewer,
  isSubmitting,
  canSubmit,
  onTogglePdf,
  onCancel,
  onSubmit,
  labels,
}: DraftEditActionsProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      {hasPdf ? (
        <Button
          type="button"
          onClick={onTogglePdf}
          variant="outline"
          className="flex items-center gap-2 border-green-200 text-brand-trust hover:bg-green-50"
        >
          {showPdfViewer ? (
            <>
              <HiOutlineEyeOff className="size-4" />
              {labels.hidePdf}
            </>
          ) : (
            <>
              <HiOutlineDocumentText className="size-4" />
              {labels.showPdf}
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
