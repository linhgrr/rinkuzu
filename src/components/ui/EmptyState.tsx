'use client';

import { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/shared/constants/routes';
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

/**
 * The one CTA shared by the learner empty states (history, bookmarks, review): a single
 * 44 px button-styled link to Explore, where a learner can take a first quiz (RIN-691).
 */
export function EmptyStateExploreAction() {
  const tCommon = useTranslations('common');

  return (
    <Link href={ROUTES.EXPLORE} className="btn btn-primary">
      {tCommon('exploreQuizzes')}
    </Link>
  );
}
