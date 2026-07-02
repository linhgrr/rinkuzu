'use client';

import { Button } from '@/components/ui/Button';
import { HiOutlineCloudUpload } from 'react-icons/hi';
import type { TranslateFn } from '@/features/adaptive/types/learning';

type FloatingUploadActionProps = {
  onClick: () => void;
  t: TranslateFn;
};

export const FloatingUploadAction = ({ onClick, t }: FloatingUploadActionProps) => (
  <Button
    type="button"
    onClick={onClick}
    className="group fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-action text-white shadow-2xl transition-[width,border-radius,transform] active:scale-90 sm:h-16 sm:w-16 md:bottom-10 md:right-8 md:h-20 md:w-20 md:hover:w-48 md:hover:rounded-[2rem]"
    aria-label={t('newLesson')}
    title={t('newLesson')}
  >
    <div className="flex items-center gap-2">
      <HiOutlineCloudUpload className="size-8" />
      <span className="hidden whitespace-nowrap font-bold md:group-hover:block">
        {t('newLesson')}
      </span>
    </div>
  </Button>
);
