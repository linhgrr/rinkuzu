'use client';

import { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: ReactNode;
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  const tCommon = useTranslations('common');
  const displayTitle = title ?? tCommon('noData');

  return (
    <div className={cn('py-12 text-center font-home', className)}>
      {icon && <div className="mb-4 flex justify-center text-ink-muted">{icon}</div>}
      {displayTitle && <h3 className="font-home text-lg font-semibold text-ink">{displayTitle}</h3>}
      {description && <p className="font-home mt-1.5 text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
