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
  /** Title heading level; 2 when the empty state sits directly under the page h1 (RIN-1200). */
  headingLevel?: 2 | 3;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  headingLevel = 3,
}: EmptyStateProps) {
  const tCommon = useTranslations('common');
  const displayTitle = title ?? tCommon('noData');
  const Heading = headingLevel === 2 ? 'h2' : 'h3';

  return (
    <div className={cn('py-12 text-center font-home', className)}>
      {icon && <div className="mb-4 flex justify-center text-ink-muted">{icon}</div>}
      {displayTitle && (
        <Heading className="font-home text-lg font-semibold text-ink">{displayTitle}</Heading>
      )}
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
