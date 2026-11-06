'use client';

import { useEffect, useRef } from 'react';
import { HiOutlineExclamationCircle } from 'react-icons/hi';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface CreateQuizErrorAlertProps {
  message: string;
  className?: string;
  /**
   * Scroll the alert into view and move focus to it when it appears. Used for
   * submit-step errors that sit next to the submit button, so a failed submit
   * at 375px is never off screen (RIN-991).
   */
  focusOnShow?: boolean;
}

export function CreateQuizErrorAlert({
  message,
  className,
  focusOnShow = false,
}: CreateQuizErrorAlertProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!focusOnShow || !message || !node) return;
    node.scrollIntoView?.({ block: 'center' });
    node.focus({ preventScroll: true });
  }, [focusOnShow, message]);

  if (!message) {
    return null;
  }

  return (
    <Card
      ref={ref}
      variant="bordered"
      className={cn('border-red-200 bg-red-50 p-4 outline-none', className)}
      role="alert"
      aria-live="polite"
      {...(focusOnShow ? { tabIndex: -1 } : {})}
    >
      <div className="flex items-start text-red-700">
        <HiOutlineExclamationCircle className="mr-2 mt-0.5 size-5 flex-shrink-0" />
        <span className="min-w-0 break-words text-sm font-medium">{message}</span>
      </div>
    </Card>
  );
}
