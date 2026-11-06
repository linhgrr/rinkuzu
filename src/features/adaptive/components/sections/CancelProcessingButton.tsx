'use client';

import { HiOutlineX } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import type { TranslateFn } from '@/features/adaptive/types/learning';

/** One Cancel style for the hero and the job cards: ghost, red text (RIN-1005). */
export function CancelProcessingButton({
  busy,
  onCancel,
  t,
}: {
  busy: boolean;
  onCancel: () => void;
  t: TranslateFn;
}) {
  return (
    <Button
      variant="ghost"
      disabled={busy}
      onClick={(event) => {
        event.stopPropagation();
        onCancel();
      }}
      className="min-h-11 bg-transparent px-0 text-sm font-semibold text-red-600 hover:bg-transparent hover:text-red-700"
    >
      <HiOutlineX className="size-4" aria-hidden="true" />{' '}
      {busy ? t('cancellingProcessing') : t('cancelProcessing')}
    </Button>
  );
}
