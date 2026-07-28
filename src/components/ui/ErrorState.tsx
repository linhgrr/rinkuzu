'use client';

import { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Button } from './Button';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({ message, onRetry, action, className = '' }: ErrorStateProps) {
  const tCommon = useTranslations('common');

  return (
    <div
      role="alert"
      className={cn('rounded-xl border border-error bg-error-surface p-4', className)}
    >
      <p className="font-home text-sm text-error">{message}</p>
      {onRetry ? (
        <Button variant="destructive" size="sm" className="mt-3 font-home" onClick={onRetry}>
          {tCommon('retry')}
        </Button>
      ) : action ? (
        <div className="mt-2">{action}</div>
      ) : null}
    </div>
  );
}
